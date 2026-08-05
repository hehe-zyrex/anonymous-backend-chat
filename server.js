const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Create the web server
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store all chat rooms and messages in memory
const channels = new Map();
const users = new Map();

// Default chat rooms that can't be deleted
const DEFAULT_CHANNELS = ['lounge', 'tech', 'games', 'random'];

// Initialize default channels
DEFAULT_CHANNELS.forEach(channel => {
    if (!channels.has(channel)) {
        channels.set(channel, {
            messages: [],
            users: new Map(),
            isDefault: true,
            owner: null
        });
    }
});

// When a user connects to the chat
io.on('connection', (socket) => {
    // Get username and channel from the connection
    const username = socket.handshake.query.username;
    const channelName = socket.handshake.query.channel || 'lounge';
    
    // Validate username
    if (!username || username.length > 20) {
        socket.emit('error', 'Invalid username');
        socket.disconnect();
        return;
    }
    
    // Check if username is taken in this channel
    const channel = channels.get(channelName);
    if (!channel || channel.users.has(username)) {
        socket.emit('error', 'Username already taken in this channel');
        socket.disconnect();
        return;
    }
    
    // Save user info
    socket.username = username;
    socket.channel = channelName;
    channel.users.set(username, socket.id);
    users.set(socket.id, { username, channel: channelName });
    
    // Join the channel
    socket.join(channelName);
    
    // Send chat history to the user
    socket.emit('history', channel.messages);
    
    // Send current user count
    io.to(channelName).emit('user_count', channel.users.size);
    
    // When user sends a message
    socket.on('message', (text) => {
        if (!text || text.length > 1000) return;
        
        const messageData = {
            username: socket.username,
            text: text.trim(),
            timestamp: Date.now(),
            isOwn: false
        };
        
        // Store message
        channel.messages.push(messageData);
        if (channel.messages.length > 100) {
            channel.messages.shift(); // Keep only last 100 messages
        }
        
        // Send to everyone in the channel
        io.to(channelName).emit('message', messageData);
    });
    
    // When user creates a new room
    socket.on('create_room', (roomName) => {
        roomName = roomName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        if (!roomName || roomName.length < 2) {
            socket.emit('error', 'Room name must be at least 2 characters');
            return;
        }
        
        if (channels.has(roomName)) {
            socket.emit('error', 'Room already exists');
            return;
        }
        
        // Create the new room
        const newChannel = {
            messages: [],
            users: new Map(),
            isDefault: false,
            owner: socket.username
        };
        channels.set(roomName, newChannel);
        
        // Move user to the new room
        const oldChannel = socket.channel;
        socket.leave(oldChannel);
        socket.channel = roomName;
        newChannel.users.set(socket.username, socket.id);
        
        socket.join(roomName);
        socket.emit('system_message', `Room "${roomName}" created! You are the owner.`);
        io.emit('room_list_update', getChannelList());
    });
    
    // When user switches rooms
    socket.on('switch_room', (newRoom) => {
        if (!channels.has(newRoom)) {
            socket.emit('error', 'Room does not exist');
            return;
        }
        
        const oldChannel = socket.channel;
        const oldChannelData = channels.get(oldChannel);
        const newChannelData = channels.get(newRoom);
        
        // Leave old room
        socket.leave(oldChannel);
        if (oldChannelData) {
            oldChannelData.users.delete(socket.username);
        }
        
        // Join new room
        socket.channel = newRoom;
        newChannelData.users.set(socket.username, socket.id);
        socket.join(newRoom);
        
        // Send history of new room
        socket.emit('history', newChannelData.messages);
    });
    
    // When user disconnects
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (!user) return;
        
        const { username, channel: userChannel } = user;
        const channelData = channels.get(userChannel);
        
        if (channelData) {
            channelData.users.delete(username);
            io.to(userChannel).emit('user_count', channelData.users.size);
        }
        
        users.delete(socket.id);
        socket.leave(userChannel);
    });
});

// Helper function to get list of all rooms
function getChannelList() {
    const list = [];
    for (const [name, data] of channels) {
        list.push({
            name: name,
            userCount: data.users.size,
            isDefault: data.isDefault || false,
            hasOwner: data.owner !== null
        });
    }
    return list;
}

// Health check endpoint (for keeping the server awake)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        channels: channels.size, 
        users: users.size
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chat server running on port ${PORT}`);
    console.log(`Default channels: ${DEFAULT_CHANNELS.join(', ')}`);
});
