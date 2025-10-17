import express from 'express'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const prisma = new PrismaClient()

// Basic health check
app.get('/', (_req, res) => {
  res.send('FST API is live 🎉')
})

// Add other routes here
// app.use('/api/v1/auth', authRoutes) // Example

// 🚨 Important for Render port detection
const PORT = parseInt(process.env.PORT || '3000', 10)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`)
})
