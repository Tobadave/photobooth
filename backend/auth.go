package main

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/api/idtoken"
)

type Claims struct {
	UserID   uint   `json:"uid,omitempty"`
	Purpose  string `json:"purpose"` // "session" | "signup"
	GoogleID string `json:"gid,omitempty"`
	Email    string `json:"email,omitempty"`
	Name     string `json:"name,omitempty"`
	Picture  string `json:"picture,omitempty"`
	jwt.RegisteredClaims
}

func signToken(c Claims, ttl time.Duration) (string, error) {
	c.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte(os.Getenv("JWT_SECRET")))
}

func parseToken(s string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(s, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !t.Valid {
		return nil, errors.New("invalid token")
	}
	return t.Claims.(*Claims), nil
}

func authMiddleware(required bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if strings.HasPrefix(h, "Bearer ") {
			if cl, err := parseToken(strings.TrimPrefix(h, "Bearer ")); err == nil && cl.Purpose == "session" {
				c.Set("uid", cl.UserID)
				c.Next()
				return
			}
		}
		if required {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "please sign in"})
			return
		}
		c.Next()
	}
}

func currentUID(c *gin.Context) uint {
	v, ok := c.Get("uid")
	if !ok {
		return 0
	}
	return v.(uint)
}

// POST /api/auth/google  { credential }
// Verifies the Google ID token. Existing user -> session token.
// New user -> short-lived signup token, frontend then asks for name + username.
func googleAuth(c *gin.Context) {
	var in struct {
		Credential string `json:"credential"`
	}
	if err := c.ShouldBindJSON(&in); err != nil || in.Credential == "" {
		c.JSON(400, gin.H{"error": "credential required"})
		return
	}
	p, err := idtoken.Validate(c.Request.Context(), in.Credential, os.Getenv("GOOGLE_CLIENT_ID"))
	if err != nil {
		c.JSON(401, gin.H{"error": "invalid Google token"})
		return
	}
	email, _ := p.Claims["email"].(string)
	verified, _ := p.Claims["email_verified"].(bool)
	name, _ := p.Claims["name"].(string)
	picture, _ := p.Claims["picture"].(string)
	if email == "" || !verified {
		c.JSON(401, gin.H{"error": "Google email is not verified"})
		return
	}

	var u User
	if err := db.Where("google_id = ?", p.Subject).First(&u).Error; err == nil {
		tok, _ := signToken(Claims{UserID: u.ID, Purpose: "session"}, 30*24*time.Hour)
		c.JSON(200, gin.H{"token": tok, "user": meUser(u)})
		return
	}

	st, _ := signToken(Claims{Purpose: "signup", GoogleID: p.Subject, Email: email, Name: name, Picture: picture}, 15*time.Minute)
	c.JSON(200, gin.H{"needs_signup": true, "signup_token": st, "name": name, "email": email, "picture": picture})
}

// POST /api/auth/signup { signup_token, name, username }
func completeSignup(c *gin.Context) {
	var in struct {
		SignupToken string `json:"signup_token"`
		Name        string `json:"name"`
		Username    string `json:"username"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}
	cl, err := parseToken(in.SignupToken)
	if err != nil || cl.Purpose != "signup" {
		c.JSON(401, gin.H{"error": "signup expired, please continue with Google again"})
		return
	}
	name := strings.TrimSpace(in.Name)
	username := strings.ToLower(strings.TrimSpace(in.Username))
	if name == "" || len(name) > 60 {
		c.JSON(400, gin.H{"error": "name is required (max 60 characters)"})
		return
	}
	if !validUsername(username) {
		c.JSON(400, gin.H{"error": "username must be 3-20 characters: a-z, 0-9, underscore"})
		return
	}
	u := User{GoogleID: cl.GoogleID, Email: cl.Email, Name: name, Username: username, Avatar: cl.Picture}
	if err := db.Create(&u).Error; err != nil {
		c.JSON(409, gin.H{"error": "that username (or account) is already taken"})
		return
	}
	tok, _ := signToken(Claims{UserID: u.ID, Purpose: "session"}, 30*24*time.Hour)
	c.JSON(201, gin.H{"token": tok, "user": meUser(u)})
}

// GET /api/auth/username-available?username=abc
func usernameAvailable(c *gin.Context) {
	u := strings.ToLower(strings.TrimSpace(c.Query("username")))
	if !validUsername(u) {
		c.JSON(200, gin.H{"valid": false, "available": false})
		return
	}
	var n int64
	q := db.Model(&User{}).Where("username = ?", u)
	if uid := currentUID(c); uid != 0 {
		q = q.Where("id <> ?", uid)
	}
	q.Count(&n)
	c.JSON(200, gin.H{"valid": true, "available": n == 0})
}

// GET /api/me
func getMe(c *gin.Context) {
	var u User
	if err := db.First(&u, currentUID(c)).Error; err != nil {
		c.JSON(404, gin.H{"error": "user not found"})
		return
	}
	c.JSON(200, gin.H{"user": meUser(u)})
}

// PATCH /api/me { name?, username?, bio? }
func updateMe(c *gin.Context) {
	var in struct {
		Name     *string `json:"name"`
		Username *string `json:"username"`
		Bio      *string `json:"bio"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}
	var u User
	if err := db.First(&u, currentUID(c)).Error; err != nil {
		c.JSON(404, gin.H{"error": "user not found"})
		return
	}
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" || len(n) > 60 {
			c.JSON(400, gin.H{"error": "name is required (max 60 characters)"})
			return
		}
		u.Name = n
	}
	if in.Bio != nil {
		b := strings.TrimSpace(*in.Bio)
		if len(b) > 300 {
			c.JSON(400, gin.H{"error": "bio is too long (max 300 characters)"})
			return
		}
		u.Bio = b
	}
	if in.Username != nil {
		un := strings.ToLower(strings.TrimSpace(*in.Username))
		if !validUsername(un) {
			c.JSON(400, gin.H{"error": "username must be 3-20 characters: a-z, 0-9, underscore"})
			return
		}
		if un != u.Username {
			var n int64
			db.Model(&User{}).Where("username = ? AND id <> ?", un, u.ID).Count(&n)
			if n > 0 {
				c.JSON(409, gin.H{"error": "that username is taken"})
				return
			}
			u.Username = un
		}
	}
	if err := db.Save(&u).Error; err != nil {
		c.JSON(409, gin.H{"error": "could not save profile"})
		return
	}
	c.JSON(200, gin.H{"user": meUser(u)})
}

// GET /api/users/:username  -> public profile + public albums
func getProfile(c *gin.Context) {
	var u User
	if err := db.Where("username = ?", strings.ToLower(c.Param("username"))).First(&u).Error; err != nil {
		c.JSON(404, gin.H{"error": "user not found"})
		return
	}
	var albums []Album
	db.Preload("Photos", orderPhotos).Where("user_id = ? AND visibility = ?", u.ID, "public").Order("created_at desc").Find(&albums)
	var privateCount int64
	db.Model(&Album{}).Where("user_id = ? AND visibility = ?", u.ID, "private").Count(&privateCount)

	list := make([]gin.H, 0, len(albums))
	for _, a := range albums {
		list = append(list, summarize(a))
	}
	c.JSON(200, gin.H{"user": publicUser(u), "albums": list, "private_count": privateCount})
}
