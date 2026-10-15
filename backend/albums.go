package main

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxPhotoSize = 10 << 20 // 10 MB

var allowedTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

func orderPhotos(d *gorm.DB) *gorm.DB { return d.Order("id asc") }

func cleanVisibility(v string) (string, bool) {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" {
		return "public", true
	}
	return v, v == "public" || v == "private"
}

// owner | granted | pending | declined | none
func accessFor(a Album, uid uint) string {
	if uid != 0 && a.UserID == uid {
		return "owner"
	}
	if a.Visibility == "public" {
		return "granted"
	}
	if uid == 0 {
		return "none"
	}
	var r AccessRequest
	if err := db.Where("album_id = ? AND requester_id = ?", a.ID, uid).First(&r).Error; err != nil {
		return "none"
	}
	switch r.Status {
	case "accepted":
		return "granted"
	case "pending":
		return "pending"
	}
	return "declined"
}

func ownedAlbum(c *gin.Context) (Album, bool) {
	var a Album
	err := db.Preload("Photos", orderPhotos).Where("public_id = ?", strings.ToUpper(c.Param("id"))).First(&a).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "album not found"})
		return a, false
	}
	if a.UserID != currentUID(c) {
		c.JSON(403, gin.H{"error": "you do not own this album"})
		return a, false
	}
	return a, true
}

// POST /api/albums { title, description, visibility }
func createAlbum(c *gin.Context) {
	var in struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Visibility  string `json:"visibility"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}
	title := strings.TrimSpace(in.Title)
	if title == "" || len(title) > 80 {
		c.JSON(400, gin.H{"error": "title is required (max 80 characters)"})
		return
	}
	vis, ok := cleanVisibility(in.Visibility)
	if !ok {
		c.JSON(400, gin.H{"error": "visibility must be public or private"})
		return
	}
	a := Album{
		PublicID: newAlbumID(), UserID: currentUID(c), Title: title,
		Description: strings.TrimSpace(in.Description), Visibility: vis,
	}
	if err := db.Create(&a).Error; err != nil {
		c.JSON(500, gin.H{"error": "could not create album"})
		return
	}
	c.JSON(201, gin.H{"album": summarize(a)})
}

// GET /api/my/albums
func myAlbums(c *gin.Context) {
	var albums []Album
	db.Preload("Photos", orderPhotos).Where("user_id = ?", currentUID(c)).Order("created_at desc").Find(&albums)
	list := make([]gin.H, 0, len(albums))
	for _, a := range albums {
		list = append(list, summarize(a))
	}
	c.JSON(200, gin.H{"albums": list})
}

// GET /api/albums/:id  (works for anyone; photos only when access is owner/granted)
func getAlbum(c *gin.Context) {
	uid := currentUID(c)
	var a Album
	err := db.Preload("User").Preload("Photos", orderPhotos).
		Where("public_id = ?", strings.ToUpper(c.Param("id"))).First(&a).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "no album found with that ID"})
		return
	}
	access := accessFor(a, uid)
	out := gin.H{
		"id": a.PublicID, "title": a.Title, "description": a.Description,
		"visibility": a.Visibility, "owner": publicUser(a.User),
		"access": access, "photo_count": len(a.Photos),
	}
	if access == "owner" || access == "granted" {
		photos := make([]gin.H, 0, len(a.Photos))
		for _, p := range a.Photos {
			photos = append(photos, gin.H{"id": p.ID, "url": photoURL(p.Filename)})
		}
		out["photos"] = photos
	}
	c.JSON(200, out)
}

// PATCH /api/albums/:id { title?, description?, visibility? }
func updateAlbum(c *gin.Context) {
	a, ok := ownedAlbum(c)
	if !ok {
		return
	}
	var in struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Visibility  *string `json:"visibility"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}
	if in.Title != nil {
		t := strings.TrimSpace(*in.Title)
		if t == "" || len(t) > 80 {
			c.JSON(400, gin.H{"error": "title is required (max 80 characters)"})
			return
		}
		a.Title = t
	}
	if in.Description != nil {
		a.Description = strings.TrimSpace(*in.Description)
	}
	if in.Visibility != nil {
		v, ok := cleanVisibility(*in.Visibility)
		if !ok {
			c.JSON(400, gin.H{"error": "visibility must be public or private"})
			return
		}
		a.Visibility = v
	}
	db.Model(&Album{}).Where("id = ?", a.ID).Updates(map[string]any{
		"title": a.Title, "description": a.Description, "visibility": a.Visibility,
	})
	c.JSON(200, gin.H{"album": summarize(a)})
}

// DELETE /api/albums/:id
func deleteAlbum(c *gin.Context) {
	a, ok := ownedAlbum(c)
	if !ok {
		return
	}
	for _, p := range a.Photos {
		_ = os.Remove(filepath.Join("uploads", p.Filename))
	}
	db.Transaction(func(tx *gorm.DB) error {
		tx.Where("album_id = ?", a.ID).Delete(&Photo{})
		tx.Where("album_id = ?", a.ID).Delete(&AccessRequest{})
		return tx.Delete(&Album{}, a.ID).Error
	})
	c.JSON(200, gin.H{"ok": true})
}

// POST /api/albums/:id/photos  (multipart, field "photos", multiple files)
func uploadPhotos(c *gin.Context) {
	a, ok := ownedAlbum(c)
	if !ok {
		return
	}
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid upload"})
		return
	}
	files := form.File["photos"]
	if len(files) == 0 {
		c.JSON(400, gin.H{"error": "choose at least one photo"})
		return
	}
	if len(files) > 20 {
		c.JSON(400, gin.H{"error": "max 20 photos per upload"})
		return
	}
	saved, skipped := 0, 0
	for _, fh := range files {
		if fh.Size > maxPhotoSize {
			skipped++
			continue
		}
		f, err := fh.Open()
		if err != nil {
			skipped++
			continue
		}
		head := make([]byte, 512)
		n, _ := f.Read(head)
		ext, allowed := allowedTypes[http.DetectContentType(head[:n])]
		if !allowed {
			f.Close()
			skipped++
			continue
		}
		_, _ = f.Seek(0, io.SeekStart)
		name := randomHex(16) + ext
		dst, err := os.Create(filepath.Join("uploads", name))
		if err != nil {
			f.Close()
			skipped++
			continue
		}
		_, cpErr := io.Copy(dst, f)
		dst.Close()
		f.Close()
		if cpErr != nil {
			os.Remove(filepath.Join("uploads", name))
			skipped++
			continue
		}
		db.Create(&Photo{AlbumID: a.ID, Filename: name})
		saved++
	}
	c.JSON(201, gin.H{"saved": saved, "skipped": skipped})
}

// DELETE /api/photos/:photoID
func deletePhoto(c *gin.Context) {
	var p Photo
	if err := db.First(&p, c.Param("photoID")).Error; err != nil {
		c.JSON(404, gin.H{"error": "photo not found"})
		return
	}
	var a Album
	if err := db.First(&a, p.AlbumID).Error; err != nil || a.UserID != currentUID(c) {
		c.JSON(403, gin.H{"error": "you do not own this photo"})
		return
	}
	_ = os.Remove(filepath.Join("uploads", p.Filename))
	db.Delete(&p)
	c.JSON(200, gin.H{"ok": true})
}
