package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux() //creates a new router

	mux.HandleFunc("GET /health", func (w http.ResponseWriter, r *http.Request){ 
		fmt.Fprintf(w, "ok")	//resposnse to the browser
	})

	log.Printf("starting server on :8080")
	report := http.ListenAndServe("8080", mux)
	log.Fatal(report)
}