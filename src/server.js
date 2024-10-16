const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const prisma = new PrismaClient();

const app = express();

// CORS configuration to allow frontend requests and handle sessions
app.use(cors({
    origin: 'http://localhost:5173', // Vite frontend URL
    methods: ['GET', 'POST'],
    credentials: true // Allow cookies (session) to be sent
}));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware for storing user session
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true if using HTTPS
        maxAge: 60 * 60 * 1000 , // 1 hour
        sameSite: 'lax' 
    }
}));

// Register a new user
// Register a new user
app.post('/register', async (req, res) => {
    const { username } = req.body;

    try {
        // Check if the username already exists
        const existingUser = await prisma.user.findUnique({
            where: { username: username }
        });
        
        if (existingUser) {
            // Send a response with a custom message if user already exists
            return res.status(400).json({ message: 'Username already exists' });
        }
        
        // Create a new user
        const newUser = await prisma.user.create({
            data: { username: username }
        });
        
        // Set session with user data
        req.session.user = { id: newUser.id, username: newUser.username, highScore: newUser.highScore };
        
        // Send success response
        res.status(201).json({
            message: 'Registration successful!',
            user: newUser
        });
    } catch (error) {
        // Redirect to game page after successful registration
        // res.redirect('/game');
        res.status(500).send('Server error');
    }
});


// User login route
app.post('/login', async (req, res) => {
    const { username } = req.body;

    try {
        // Find the user by username
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return res.status(400).send('User not found');
        }

        // Set session with user data
        req.session.user = { id: user.id, username: user.username, highScore: user.highScore };

        // Send user data as response
        res.json({
            status: "Success!",
            message: "User logged in successfully",
            data: user
        });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Roll dice (only for logged-in users)
app.get('/roll-dice', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('Not authorized');
    }

    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const userId = req.session.user.id;

    try {
        // Record the dice roll score
        await prisma.score.create({
            data: {
                value: diceRoll,
                userId: userId
            }
        });

        // Update the user's high score if the dice roll is higher
        if (diceRoll > req.session.user.highScore) {
            req.session.user.highScore = diceRoll;

            await prisma.user.update({
                where: { id: userId },
                data: { highScore: diceRoll }
            });
        }

        // Respond with dice roll result and updated high score
        res.json({ result: diceRoll, highScore: req.session.user.highScore });
    } catch (error) {
        console.error('Error rolling dice:', error);
        res.status(500).send('Server error');
    }
});

// Get all users with their high score history
app.get('/users/highscores', async (req, res) => {
    try {
        // Fetch all users with their scores
        const users = await prisma.user.findMany({
            include: { scores: true } // Include scores associated with the user
        });

        // Format the data to include only relevant fields
        const userWithHighScores = users.map(user => ({
            username: user.username,
            highScore: user.highScore,
            scores: user.scores.map(score => ({
                value: score.value,
                createdAt: score.createdAt
            }))
        }));

        res.json(userWithHighScores);
    } catch (error) {
        console.error('Error fetching user high scores:', error);
        res.status(500).send('Server error');
    }
});


// Fetch user history (including scores)
app.get('/user/history', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('Not authorized');
    }

    const userId = req.session.user.id;
    
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { scores: true } // Include scores related to the user
        });

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.json({
            username: user.username,
            highScores: user.scores // Ensure scores are returned
        });
    } catch (error) {
        console.error('Error fetching user history:', error);
        res.status(500).send('Server error');
    }
});



// Game page (only for logged-in users)
app.get('/game', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    // Send the game HTML file if user is logged in
    // res.sendFile(__dirname + '/public/game.html');
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Logout failed');
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.status(200).send({ message: 'Logged out successfully' });
    });
});



module.exports = app;
