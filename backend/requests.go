package main

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// POST /api/albums/:id/request  -> ask owner for access to a private album
func requestAccess(c *gin.Context) {
	uid := currentUID(c)
	var a Album
	if err := db.Where("public_id = ?", strings.ToUpper(c.Param("id"))).First(&a).Error; err != nil {
		c.JSON(404, gin.H{"error": "no album found with that ID"})
		return
	}
	if a.UserID == uid {
		c.JSON(400, gin.H{"error": "this is your own album"})
		return
	}
	if a.Visibility == "public" {
		c.JSON(400, gin.H{"error": "this album is public, no request needed"})
		return
	}
	var r AccessRequest
	if err := db.Where("album_id = ? AND requester_id = ?", a.ID, uid).First(&r).Error; err == nil {
		if r.Status == "declined" {
			c.JSON(403, gin.H{"error": "the owner declined your request"})
			return
		}
		c.JSON(200, gin.H{"status": r.Status})
		return
	}
	r = AccessRequest{AlbumID: a.ID, RequesterID: uid, Status: "pending"}
	if err := db.Create(&r).Error; err != nil {
		c.JSON(500, gin.H{"error": "could not send request"})
		return
	}
	c.JSON(201, gin.H{"status": "pending"})
}

// GET /api/requests/incoming -> requests for albums I own
func incomingRequests(c *gin.Context) {
	var reqs []AccessRequest
	db.Preload("Album").Preload("Requester").
		Joins("JOIN albums ON albums.id = access_requests.album_id").
		Where("albums.user_id = ?", currentUID(c)).
		Order("access_requests.created_at desc").Find(&reqs)
	out := make([]gin.H, 0, len(reqs))
	for _, r := range reqs {
		out = append(out, gin.H{
			"id": r.ID, "status": r.Status, "created_at": r.CreatedAt,
			"album":     gin.H{"id": r.Album.PublicID, "title": r.Album.Title},
			"requester": publicUser(r.Requester),
		})
	}
	c.JSON(200, gin.H{"requests": out})
}

// GET /api/requests/outgoing -> requests I have sent
func outgoingRequests(c *gin.Context) {
	var reqs []AccessRequest
	db.Preload("Album").Where("requester_id = ?", currentUID(c)).Order("created_at desc").Find(&reqs)
	out := make([]gin.H, 0, len(reqs))
	for _, r := range reqs {
		out = append(out, gin.H{
			"id": r.ID, "status": r.Status, "created_at": r.CreatedAt,
			"album": gin.H{"id": r.Album.PublicID, "title": r.Album.Title},
		})
	}
	c.JSON(200, gin.H{"requests": out})
}

// POST /api/requests/:id/respond { action: "accept" | "decline" }
// Owner only. "decline" on an accepted request revokes access.
func respondRequest(c *gin.Context) {
	var in struct {
		Action string `json:"action"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || (in.Action != "accept" && in.Action != "decline") {
		c.JSON(400, gin.H{"error": "action must be accept or decline"})
		return
	}
	var r AccessRequest
	if err := db.Preload("Album").First(&r, c.Param("id")).Error; err != nil {
		c.JSON(404, gin.H{"error": "request not found"})
		return
	}
	if r.Album.UserID != currentUID(c) {
		c.JSON(403, gin.H{"error": "not your album"})
		return
	}
	if in.Action == "accept" {
		r.Status = "accepted"
	} else {
		r.Status = "declined"
	}
	db.Model(&r).Update("status", r.Status)
	c.JSON(200, gin.H{"status": r.Status})
}

// DELETE /api/requests/:id  -> requester cancels their own request
func cancelRequest(c *gin.Context) {
	var r AccessRequest
	if err := db.First(&r, c.Param("id")).Error; err != nil || r.RequesterID != currentUID(c) {
		c.JSON(404, gin.H{"error": "request not found"})
		return
	}
	db.Delete(&r)
	c.JSON(200, gin.H{"ok": true})
}
