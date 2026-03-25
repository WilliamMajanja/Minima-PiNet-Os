package api

import (
	"github.com/gin-gonic/gin"
)

func StartDashboardAPI() {
	r := gin.Default()

	r.GET("/api/cluster/status", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy",
			"nodes":  3,
			"ai_workers": 1,
		})
	})

	r.POST("/api/workloads/deploy", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Workload deployed successfully",
		})
	})

	r.Run(":8080")
}
