# Camera Rental System

A modern camera rental platform built with vanilla JavaScript and Supabase.

## Features

- **Dual Portal System**: Separate interfaces for buyers and sellers
- **Authentication**: Secure login/signup with role-based access control
- **Seller Dashboard**: List and manage camera inventory
- **Buyer Dashboard**: Browse available cameras and request rentals
- **Real-time Database**: Powered by Supabase

## Tech Stack

- HTML5, CSS3, JavaScript (Vanilla)
- Supabase (Backend & Authentication)
- GitHub Pages (Hosting)

## Setup

1. Clone this repository
2. Update `config.js` with your Supabase credentials
3. Run the SQL schema in your Supabase project
4. Open `index.html` in your browser

## Live Demo

[View Live Site](https://YOUR_USERNAME.github.io/camera-rental-system/)

## Database Schema

See `schema.sql` for the complete database structure including:
- `profiles` - User profiles with role assignment
- `cameras` - Camera listings
- `rentals` - Rental requests and bookings
