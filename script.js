class AnonymousChat {
    constructor() {
        this.socket = null;
        this.username = '';
        this.channel = 'lounge';
        this.connected = false;
        this.isOwner = false;
        this.rooms = [];
        
        this.elements = {
            loginScreen: document.getElementById('loginScreen'),
            chatScreen: document.getElementById('chatScreen'),
            usernameInput: document.getElementById('usernameInput'),
            channelInput: document.getElementById('channelInput'),
            joinBtn: document.getElementById('joinBtn'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            messageContainer: document.getElementById('messageContainer'),
            currentChannel: document.getElementById('currentChannel'),
            userCount: document.getElementById('userCount'),
            roomOwner: document.getElementById('roomOwner'),
            logoutBtn: document.getElementById('logoutBtn'),
            roomListBtn: document.getElementById('roomListBtn'),
            roomModal: document.getElementById('roomModal'),
            roomListContainer: document.getElementById('roomListContainer'),
            newRoomInput: document.getElementById('newRoomInput'),
            createRoomBtn: document.getElementById('createRoomBtn'),
            closeModal: document.querySelector('.close-modal'),
        };
        
        this.init();
    }
    
    init() {
        // Channel tag click to auto-fill channel name
        document.querySelectorAll('.channel-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                this.elements.channelInput.value = tag.dataset.channel;
            });
        });
        
        // Join button and enter key
        this.elements.joinBtn.addEventListener('click', () => this.joinChat());
        this.elements.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });
        this.elements.channelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });
        
        // Send message
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Logout
        this.elements.logoutBtn.addEventListener('click', () => this.logout());
        
        // Room list
        this.elements.roomListBtn.addEventListener('click', () => this.showRoomList());
        this.elements.closeModal.addEventListener('click', () => this.closeRoomList());
        this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.elements.newRoomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });
        
        // Close modal on outside click
        this.elements.roomModal.addEventListener('click', (e) => {
            if (e.target === this.elements.roomModal) {
                this.closeRoomList();
            }
        });
        
        // Check URL for channel
        const params = new URLSearchParams(window.location.search);
        const channel = params.get('channel');
        if (channel) {
            this.elements.channelInput.value = channel;
        }
    }
    
    joinChat() {
        const username = this.elements.usernameInput.value.trim();
        const channel = this.elements.channelInput.value.trim() || 'lounge';
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        if (username.length > 20) {
            alert('Username must be 20 characters or less');
            return;
        }
        
        this.username = username;
        this.channel = channel;
        
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('channel', channel);
        window.history.pushState({}, '', url);
        
        this.connect();
    }
    
    connect() {
        // ⚠️ IMPORTANT: Replace this with your Render URL after deployment!
        // For now, we'll use localhost for testing
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : 'https://YOUR-BACKEND-URL.onrender.com'; // ← Change this after deployment
        
        this.socket = io(serverUrl, {
            query: {
                username: this.username,
                channel: this.channel
            }
        });
        
        this.socket.on('connect', () => {
            this.connected = true;
            this.showChatScreen();
            this.addSystemMessage(`Connected to #${this.channel}`);
        });
        
        this.socket.on('history', (messages) => {
            messages.forEach(msg => {
                this.addMessage(msg);
            });
        });
        
        this.socket.on('message', (data) => {
            this.addMessage(data);
        });
        
        this.socket.on('user_count', (count) => {
            this.elements.userCount.textContent = `${count} users`;
        });
        
        this.socket.on('system_message', (message) => {
            this.addSystemMessage(message);
        });
        
        this.socket.on('disconnect', () => {
            this.connected = false;
            this.addSystemMessage('Disconnected from server');
            this.elements.sendBtn.disabled = true;
        });
        
        this.socket.on('error', (error) => {
            alert(error);
            this.logout();
        });
    }
    
    sendMessage() {
        const text = this.elements.messageInput.value.trim();
        if (!text || !this.connected) return;
        
        this.socket.emit('message', text);
        this.elements.messageInput.value = '';
        this.elements.messageInput.focus();
    }
    
    addMessage(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.isOwn ? 'own' : 'other'}`;
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div>
                <span class="username">${this.escapeHtml(data.username)}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="content">${this.formatMessage(data.text)}</div>
        `;
        
        this.elements.messageContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = text;
        this.elements.messageContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    formatMessage(text) {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showChatScreen() {
        this.elements.loginScreen.style.display = 'none';
        this.elements.chatScreen.style.display = 'flex';
        this.elements.sendBtn.disabled = false;
        this.elements.messageInput.focus();
    }
    
    scrollToBottom() {
        const container = this.elements.messageContainer;
        container.scrollTop = container.scrollHeight;
    }
    
    showRoomList() {
        this.elements.roomModal.style.display = 'flex';
    }
    
    closeRoomList() {
        this.elements.roomModal.style.display = 'none';
    }
    
    createRoom() {
        const roomName = this.elements.newRoomInput.value.trim();
        if (!roomName) {
            alert('Please enter a room name');
            return;
        }
        
        if (roomName.length < 2) {
            alert('Room name must be at least 2 characters');
            return;
        }
        
        this.socket.emit('create_room', roomName);
        this.elements.newRoomInput.value = '';
        this.closeRoomList();
    }
    
    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.connected = false;
        this.elements.loginScreen.style.display = 'flex';
        this.elements.chatScreen.style.display = 'none';
        this.elements.messageContainer.innerHTML = '';
        this.elements.sendBtn.disabled = true;
        
        // Clear URL params
        const url = new URL(window.location);
        url.searchParams.delete('channel');
        window.history.pushState({}, '', url);
    }
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AnonymousChat();
});
