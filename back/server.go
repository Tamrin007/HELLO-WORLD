package main

import (
	"github.com/Tamrin007/contrib/static"
	"github.com/jphacks/KB_1608/back/controller"
	"gopkg.in/gin-gonic/gin.v1"
)

func main() {
	r := gin.Default()
	c := &controller.Handler{}

	// Hosting public directory on server root
	r.Use(static.Serve("/", static.LocalFile("./public", true)))

	// Routing
	r.GET("/ping", c.Pong)

	// Listening
	r.Run(":8080")
}
