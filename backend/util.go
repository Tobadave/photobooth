package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"math/big"
	"os"
	"regexp"

	"github.com/gin-gonic/gin"
)

const idAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func randomID(n int) string {
	b := make([]byte, n)
	for i := range b {
		k, _ := rand.Int(rand.Reader, big.NewInt(int64(len(idAlphabet))))
		b[i] = idAlphabet[k.Int64()]
	}
	return string(b)
}

func newAlbumID() string {
	for {
		id := randomID(10)
		var n int64
		db.Model(&Album{}).Where("public_id = ?", id).Count(&n)
		if n == 0 {
			return id
		}
	}
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)
var reserved = map[string]bool{
	"admin": true, "api": true, "root": true, "support": true, "photoshoot": true,
	"login": true, "signup": true, "settings": true, "me": true, "null": true,
}

func validUsername(u string) bool { return usernameRe.MatchString(u) && !reserved[u] }

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing env var %s (see backend/.env)", k)
	}
	return v
}

func publicUser(u User) gin.H {
	return gin.H{"id": u.ID, "name": u.Name, "username": u.Username, "bio": u.Bio, "avatar": u.Avatar}
}

func meUser(u User) gin.H {
	h := publicUser(u)
	h["email"] = u.Email
	return h
}

func photoURL(f string) string { return "/uploads/" + f }

// summarize expects a.Photos preloaded.
func summarize(a Album) gin.H {
	cover := ""
	if len(a.Photos) > 0 {
		cover = photoURL(a.Photos[0].Filename)
	}
	return gin.H{
		"id": a.PublicID, "title": a.Title, "description": a.Description,
		"visibility": a.Visibility, "photo_count": len(a.Photos),
		"cover": cover, "created_at": a.CreatedAt,
	}
}
