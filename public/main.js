const socket = io();

// Register user upon connection
let userId;
let userName = '';
let groupName = '';
socket.on('register', (id) => {
  userId = id;
  console.log(`Registered with ID: ${userId}`);
});

// Form elements
const form = document.getElementById('message-form');
const recipientInput = document.getElementById('recipient-id');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');
const recordButton = document.getElementById('record-button');
const chatWindow = document.getElementById('chat-window');
const setNameButton = document.getElementById('set-name-button');
const joinGroupButton = document.getElementById('join-group-button');
const userNameInput = document.getElementById('user-name');
const groupNameInput = document.getElementById('group-name');
const statusInput = document.getElementById('status-input');
const statusFileInput = document.getElementById('status-file-input');
const setStatusButton = document.getElementById('set-status-button');
const statusList = document.getElementById('status-list');

let mediaRecorder;
let audioChunks = [];

// Set user name
setNameButton.addEventListener('click', () => {
  userName = userNameInput.value.trim();
  if (userName) {
    socket.emit('set name', { userId, userName });
  }
});

// Join group
joinGroupButton.addEventListener('click', () => {
  groupName = groupNameInput.value.trim();
  if (groupName) {
    socket.emit('join group', { groupName });
  }
});

// // Set status
// setStatusButton.addEventListener('click', () => {
//   const status = statusInput.value.trim();
//   const file = statusFileInput.files[0];

//   if (status || file) {
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const fileData = e.target.result;
//         socket.emit('set status', { userId, userName, status, fileData, fileName: file.name, fileType: file.type });
//         addStatusToWindow(userName, status, fileData, file.name, file.type);
//       };
//       reader.readAsDataURL(file);
//     } else {
//       socket.emit('set status', { userId, userName, status });
//       addStatusToWindow(userName, status);
//     }

//     statusInput.value = ''; // Clear the status input field
//     statusFileInput.value = ''; // Clear the file input field
//   } else {
//     alert('Please enter a status or select a file.');
//   }
// });

// Listen for form submission to send a new message
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const recipientId = recipientInput.value.trim();
  const message = messageInput.value.trim();
  const files = fileInput.files;
  const timestamp = new Date().toLocaleTimeString();

  if ((recipientId || groupName) && (message || files.length > 0)) {
    if (message) {
      const messageId = Date.now();
      if (groupName) {
        socket.emit('group message', { groupName, message, timestamp, messageId, fromName: userName });
        addMessageToWindow('sent', `To group ${groupName}: ${message}`, timestamp, messageId, userName);
      } else {
        socket.emit('private message', { to: recipientId, message, timestamp, messageId, fromName: userName });
        addMessageToWindow('sent', `To ${recipientId}: ${message}`, timestamp, messageId, userName);
      }
    }

    if (files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData = e.target.result;
          const messageId = Date.now();
          if (groupName) {
            socket.emit('group file', { groupName, fileData, fileName: file.name, fileType: file.type, timestamp, messageId, fromName: userName });
            addFileToWindow('sent', fileData, file.name, file.type, `group ${groupName}`, timestamp, messageId, userName);
          } else {
            socket.emit('private file', { to: recipientId, fileData, fileName: file.name, fileType: file.type, timestamp, messageId, fromName: userName });
            addFileToWindow('sent', fileData, file.name, file.type, recipientId, timestamp, messageId, userName);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    messageInput.value = ''; // Clear the message input field
    fileInput.value = ''; // Clear the file input field
  } else {
    alert('Please enter a recipient ID or join a group, and a message or select a file.');
  }
});

// Listen for private messages from the server
socket.on('private message', ({ from, message, timestamp, messageId, fromName }) => {
  addMessageToWindow('received', `From ${fromName}: ${message}`, timestamp, messageId, fromName);
});

// Listen for private files from the server
socket.on('private file', ({ from, fileData, fileName, fileType, timestamp, messageId, fromName }) => {
  addFileToWindow('received', fileData, fileName, fileType, fromName, timestamp, messageId, fromName);
});

// Listen for group messages from the server
socket.on('group message', ({ groupName, message, timestamp, messageId, fromName }) => {
  addMessageToWindow('received', `From ${fromName} in group ${groupName}: ${message}`, timestamp, messageId, fromName);
});

// Listen for group files from the server
socket.on('group file', ({ groupName, fileData, fileName, fileType, timestamp, messageId, fromName }) => {
  addFileToWindow('received', fileData, fileName, fileType, `group ${groupName}`, timestamp, messageId, fromName);
});

// Listen for broadcast messages from the server
socket.on('broadcast', ({ message, from }) => {
  addMessageToWindow('broadcast', `From ${from}: ${message}`);
});

// Listen for error messages
socket.on('error', (errorMessage) => {
  alert(errorMessage);
});

// Listen for status updates from the server
// socket.on('status update', ({ userName, status, fileData, fileName, fileType }) => {
//   addStatusToWindow(userName, status, fileData, fileName, fileType);
// });

function addStatusToWindow(userName, status, fileData, fileName, fileType) {
  const statusElement = document.createElement('div');
  statusElement.classList.add('status');
  let content = `<strong>${userName}:</strong> ${status || ''}`;
  
  if (fileData) {
    if (fileType.startsWith('image/')) {
      content += `<img src="${fileData}" alt="${fileName}" style="max-width: 100%;">`;
    } else if (fileType.startsWith('video/')) {
      content += `<video src="${fileData}" controls style="max-width: 100%;"></video>`;
    }
  }

  statusElement.innerHTML = content;
  statusList.appendChild(statusElement);
  statusList.scrollTop = statusList.scrollHeight;
}

function addMessageToWindow(type, content, timestamp, messageId, userName) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', type);
  messageElement.dataset.id = messageId;
  messageElement.innerHTML = `
    <div>${content}</div>
    <div class="timestamp">${timestamp}</div>
    <div class="actions">
      <button onclick="deleteMessage('${messageId}')"><i class="fas fa-trash"></i></button>
      <button onclick="shareMessage('${messageId}')"><i class="fas fa-share"></i></button>
      <button onclick="editMessage('${messageId}')"><i class="fas fa-edit"></i></button>
    </div>
  `;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addFileToWindow(type, fileData, fileName, fileType, user, timestamp, messageId, userName) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', type);
  messageElement.dataset.id = messageId;

  let fileContent;
  if (fileType.startsWith('image/')) {
    fileContent = `<img src="${fileData}" alt="${fileName}" style="max-width: 100%;">`;
  } else if (fileType.startsWith('video/')) {
    fileContent = `<video src="${fileData}" controls style="max-width: 100%;"></video>`;
  } else if (fileType.startsWith('audio/')) {
    fileContent = `<audio src="${fileData}" controls></audio>`;
  } else {
    fileContent = `<a href="${fileData}" download="${fileName}">${fileName}</a>`;
  }

  const userText = type === 'sent' ? `To ${user}: ` : `From ${userName}: `;
  messageElement.innerHTML = `
    <div>${userText}</div>
    ${fileContent}
    <div class="timestamp">${timestamp}</div>
    <div class="actions">
      <button onclick="deleteMessage('${messageId}')"><i class="fas fa-trash"></i></button>
      <button onclick="shareMessage('${messageId}')"><i class="fas fa-share"></i></button>
      <button onclick="editMessage('${messageId}')"><i class="fas fa-edit"></i></button>
    </div>
  `;
  
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

recordButton.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordButton.classList.remove('recording');
    recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
  } else {
    startRecording();
  }
});

function startRecording() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData = e.target.result;
          const recipientId = recipientInput.value.trim();
          const timestamp = new Date().toLocaleTimeString();
          const messageId = Date.now();
          if (groupName) {
            socket
            socket.emit('group file', { groupName, fileData, fileName: 'voice-message.wav', fileType: 'audio/wav', timestamp, messageId, fromName: userName });
            addFileToWindow('sent', fileData, 'voice-message.wav', 'audio/wav', `group ${groupName}`, timestamp, messageId, userName);
          } else {
            socket.emit('private file', { to: recipientId, fileData, fileName: 'voice-message.wav', fileType: 'audio/wav', timestamp, messageId, fromName: userName });
            addFileToWindow('sent', fileData, 'voice-message.wav', 'audio/wav', recipientId, timestamp, messageId, userName);
          }
        };
        reader.readAsDataURL(audioBlob);
        audioChunks = [];
      };
      mediaRecorder.start();
      recordButton.classList.add('recording');
      recordButton.innerHTML = '<i class="fas fa-stop"></i>';
    }).catch(error => {
      console.error('Error accessing microphone', error);
      alert('Could not access microphone. Please ensure it is connected and you have granted permission.');
    });
  } else {
    alert('Your browser does not support audio recording.');
  }
}

function deleteMessage(messageId) {
  const messageElement = document.querySelector(`.message[data-id='${messageId}']`);
  if (messageElement) {
    socket.emit('delete message', { messageId });
    messageElement.remove();
  }
}

function shareMessage(messageId) {
  const messageElement = document.querySelector(`.message[data-id='${messageId}']`);
  if (messageElement) {
    const messageContent = messageElement.querySelector('div:first-child').textContent;
    const recipientId = prompt('Enter recipient ID to share this message:');
    if (recipientId) {
      socket.emit('private message', { to: recipientId, message: messageContent, userName });
    }
  }
}

function editMessage(messageId) {
  const messageElement = document.querySelector(`.message[data-id='${messageId}']`);
  if (messageElement) {
    const messageContent = messageElement.querySelector('div:first-child').textContent;
    const newContent = prompt('Edit your message:', messageContent);
    if (newContent !== null && newContent.trim() !== '') {
      socket.emit('update message', { messageId, newContent });
      messageElement.querySelector('div:first-child').textContent = newContent;
    }
  }
}
