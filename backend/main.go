package main

import (
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

var db *gorm.DB

func main() {
	_ = godotenv.Load()
	mustEnv("GOOGLE_CLIENT_ID")
	mustEnv("JWT_SECRET")

	var err error
	db, err = gorm.Open(sqlite.Open("photoshoot.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &Album{}, &Photo{}, &AccessRequest{}); err != nil {
		log.Fatal(err)
	}
	_ = os.MkdirAll("uploads", 0o755)

	origin := os.Getenv("FRONTEND_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}

	r := gin.Default()
	r.MaxMultipartMemory = 32 << 20
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{origin},
		AllowMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
		MaxAge:       12 * time.Hour,
	}))

	r.Static("/uploads", "./uploads")

	api := r.Group("/api")
	{
		// auth (public)
		api.POST("/auth/google", googleAuth)
		api.POST("/auth/signup", completeSignup)
		api.GET("/auth/username-available", authMiddleware(false), usernameAvailable)

		// readable by anyone (access is decided inside the handler)
		api.GET("/users/:username", getProfile)
		api.GET("/albums/:id", authMiddleware(false), getAlbum)

		// signed-in only
		a := api.Group("", authMiddleware(true))
		a.GET("/me", getMe)
		a.PATCH("/me", updateMe)

		a.GET("/my/albums", myAlbums)
		a.POST("/albums", createAlbum)
		a.PATCH("/albums/:id", updateAlbum)
		a.DELETE("/albums/:id", deleteAlbum)
		a.POST("/albums/:id/photos", uploadPhotos)
		a.DELETE("/photos/:photoID", deletePhoto)

		a.POST("/albums/:id/request", requestAccess)
		a.GET("/requests/incoming", incomingRequests)
		a.GET("/requests/outgoing", outgoingRequests)
		a.POST("/requests/:id/respond", respondRequest)
		a.DELETE("/requests/:id", cancelRequest)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("PhotoShoot API on :" + port)
	log.Fatal(r.Run(":" + port))
}
