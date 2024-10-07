// server.js
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())

// Session middleware for storing user session
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Register a new user
app.post('/register', async (req, res) => {
    const { username } = req.body;
    console.log(req.body, "testing...")
console.log("username", username)
    try {
        // Check if the username already exists
        const existingUser = await prisma.user.findUnique({
            where: { username: username }
        });

        if (existingUser) {
            return res.status(400).send('Username already taken');
        }

        // Create a new user
        const newUser = await prisma.user.create({
            data: { username: username }
        });

        // Set session with user data
        req.session.user = { id: newUser.id, username: newUser.username, highScore: newUser.highScore };
        // res.redirect('/game');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Server error');
    }
});

// Login a user
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
        res.redirect('/game');
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).send('Server error');
    }
});

// Roll dice (logged-in users only)
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

        res.json({ result: diceRoll, highScore: req.session.user.highScore });
    } catch (error) {
        console.error('Error rolling dice:', error);
        res.status(500).send('Server error');
    }
});

// Game page (only for logged-in users)
app.get('/game', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    res.sendFile(__dirname + '/public/game.html');
});

// Logout user
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports =  app
