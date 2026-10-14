package main

import (
	"encoding/json"
	"log"
	"net/http"
)

func HealthHandler(w http.ResponseWriter, r *http.Request){
	// w.Header().Set("Content-Type", "application/json")
	// w.WriteHeader(http.StatusOK)
	// json.NewEncoder(w).Encode(map[string]string{"status":"ok"})

	writeJSON(w, http.StatusOK, map[string]string{"status":"ok"})
}

func writeJSON(w http.ResponseWriter, status  int, data any){
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", HealthHandler)

	log.Printf("listening on port :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}