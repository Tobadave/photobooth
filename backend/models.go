package main

import "time"

type User struct {
	ID        uint   `gorm:"primaryKey"`
	GoogleID  string `gorm:"uniqueIndex;not null"`
	Email     string `gorm:"uniqueIndex;not null"`
	Name      string
	Username  string `gorm:"uniqueIndex;not null"`
	Bio       string
	Avatar    string
	CreatedAt time.Time
}

type Album struct {
	ID          uint   `gorm:"primaryKey"`
	PublicID    string `gorm:"uniqueIndex;not null"` // the shareable alphanumeric ID
	UserID      uint   `gorm:"index;not null"`
	User        User
	Title       string `gorm:"not null"`
	Description string
	Visibility  string `gorm:"not null;default:public"` // public | private
	Photos      []Photo
	CreatedAt   time.Time
}

type Photo struct {
	ID        uint   `gorm:"primaryKey"`
	AlbumID   uint   `gorm:"index;not null"`
	Filename  string `gorm:"not null"`
	CreatedAt time.Time
}

// AccessRequest: a user asking to see a private album.
type AccessRequest struct {
	ID          uint `gorm:"primaryKey"`
	AlbumID     uint `gorm:"not null;uniqueIndex:idx_album_requester"`
	Album       Album
	RequesterID uint `gorm:"not null;uniqueIndex:idx_album_requester"`
	Requester   User `gorm:"foreignKey:RequesterID"`
	Status      string `gorm:"not null;default:pending"` // pending | accepted | declined
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
