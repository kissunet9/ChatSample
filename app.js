/* ==========================================================================
   ChatSample - Application Logic (Vanilla JS & Firebase Realtime Database)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Views
  const listView = document.getElementById('listView');
  const chatView = document.getElementById('chatView');

  // DOM Elements - List Page
  const openCreateModalBtn = document.getElementById('openCreateModalBtn');
  const roomGrid = document.getElementById('roomGrid');
  const emptyListState = document.getElementById('emptyListState');

  // DOM Elements - Chat Room Page
  const currentRoomTitle = document.getElementById('currentRoomTitle');
  const currentRoomCreator = document.getElementById('currentRoomCreator');
  const currentUserNickname = document.getElementById('currentUserNickname');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const messagesContainer = document.getElementById('messagesContainer');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');

  // DOM Elements - Modals
  const createRoomModal = document.getElementById('createRoomModal');
  const createRoomTitleInput = document.getElementById('createRoomTitle');
  const createNicknameInput = document.getElementById('createNickname');
  const cancelCreateBtn = document.getElementById('cancelCreateBtn');
  const confirmCreateBtn = document.getElementById('confirmCreateBtn');

  const joinRoomModal = document.getElementById('joinRoomModal');
  const joinModalRoomTitle = document.getElementById('joinModalRoomTitle');
  const joinNicknameInput = document.getElementById('joinNickname');
  const cancelJoinBtn = document.getElementById('cancelJoinBtn');
  const confirmJoinBtn = document.getElementById('confirmJoinBtn');

  // State Management
  let db = null;
  let isFirebaseAvailable = false;
  let currentRoomId = null;
  let myNickname = '';
  let pendingJoinRoomId = null;
  let messagesListener = null;

  // Local fallback state (used if Firebase network fails or demo offline testing)
  let localRooms = {};

  // 1. Firebase Connection Initialization
  try {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      db = firebase.database();
      isFirebaseAvailable = true;
      console.log("Firebase Realtime Database initialized for 'chatsample'.");
    }
  } catch (err) {
    console.warn("Firebase initialized with offline/fallback mode:", err);
  }

  // 2. Initialize App Listeners
  initRoomListListener();

  // Button Events - Create Modal
  openCreateModalBtn.addEventListener('click', () => {
    createRoomTitleInput.value = '';
    createNicknameInput.value = '';
    createRoomModal.classList.remove('hidden');
    createRoomTitleInput.focus();
  });

  cancelCreateBtn.addEventListener('click', () => {
    createRoomModal.classList.add('hidden');
  });

  confirmCreateBtn.addEventListener('click', handleCreateRoom);

  // Button Events - Join Modal
  cancelJoinBtn.addEventListener('click', () => {
    joinRoomModal.classList.add('hidden');
    pendingJoinRoomId = null;
  });

  confirmJoinBtn.addEventListener('click', handleJoinRoom);

  // Leave Room Event
  leaveRoomBtn.addEventListener('click', handleLeaveRoom);

  // Send Message Event
  messageForm.addEventListener('submit', handleSendMessage);

  // Window unload listener (Clean up on tab close)
  window.addEventListener('beforeunload', () => {
    if (currentRoomId) {
      decrementRoomMember(currentRoomId);
    }
  });

  // --------------------------------------------------------------------------
  // Room List Management (FEAT-01)
  // --------------------------------------------------------------------------
  function initRoomListListener() {
    if (isFirebaseAvailable && db) {
      const roomsRef = db.ref('rooms');
      roomsRef.on('value', (snapshot) => {
        const roomsData = snapshot.val() || {};
        renderRoomGrid(roomsData);
      }, (error) => {
        console.warn("Firebase query fallback due to network/rules:", error);
        renderRoomGrid(localRooms);
      });
    } else {
      renderRoomGrid(localRooms);
    }
  }

  function renderRoomGrid(roomsObj) {
    roomGrid.innerHTML = '';
    const roomKeys = Object.keys(roomsObj);

    if (roomKeys.length === 0) {
      emptyListState.classList.remove('hidden');
      return;
    }

    emptyListState.classList.add('hidden');

    roomKeys.forEach(roomId => {
      const room = roomsObj[roomId];
      if (!room || room.memberCount <= 0) return;

      const card = document.createElement('div');
      card.className = 'room-card';

      const isFull = room.memberCount >= 2;
      const countBadgeClass = isFull ? 'count-badge full' : 'count-badge available';
      const countText = isFull ? '2/2 (정원 초과)' : `${room.memberCount}/2 (참여 가능)`;

      card.innerHTML = `
        <div class="room-card-header">
          <h3 class="room-card-title">${escapeHTML(room.title || '채팅방')}</h3>
          <span class="${countBadgeClass}">${countText}</span>
        </div>
        <div class="room-card-footer">
          <div class="creator-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>방장: ${escapeHTML(room.creator || '익명')}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (isFull) {
          alert('해당 채팅방은 정원(2/2명)이 초과되어 참여할 수 없습니다.');
          return;
        }
        openJoinModal(roomId, room.title);
      });

      roomGrid.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // Room Creation (FEAT-02)
  // --------------------------------------------------------------------------
  function handleCreateRoom() {
    const title = createRoomTitleInput.value.trim();
    const nickname = createNicknameInput.value.trim();

    if (!title) {
      alert('채팅방 이름을 입력해 주세요.');
      createRoomTitleInput.focus();
      return;
    }
    if (!nickname) {
      alert('사용할 닉네임을 입력해 주세요.');
      createNicknameInput.focus();
      return;
    }

    createRoomModal.classList.add('hidden');
    myNickname = nickname;

    const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newRoomData = {
      roomId: roomId,
      title: title,
      creator: nickname,
      memberCount: 1,
      createdAt: Date.now(),
      messages: {}
    };

    if (isFirebaseAvailable && db) {
      db.ref(`rooms/${roomId}`).set(newRoomData)
        .then(() => enterChatRoom(roomId, title, nickname, nickname))
        .catch(err => {
          console.warn("Firebase save error, fallback to local:", err);
          localRooms[roomId] = newRoomData;
          enterChatRoom(roomId, title, nickname, nickname);
        });
    } else {
      localRooms[roomId] = newRoomData;
      enterChatRoom(roomId, title, nickname, nickname);
    }
  }

  // --------------------------------------------------------------------------
  // Room Join (FEAT-03)
  // --------------------------------------------------------------------------
  function openJoinModal(roomId, roomTitle) {
    pendingJoinRoomId = roomId;
    joinModalRoomTitle.textContent = `[${roomTitle}] 참여`;
    joinNicknameInput.value = '';
    joinRoomModal.classList.remove('hidden');
    joinNicknameInput.focus();
  }

  function handleJoinRoom() {
    const nickname = joinNicknameInput.value.trim();
    if (!nickname) {
      alert('사용할 닉네임을 입력해 주세요.');
      joinNicknameInput.focus();
      return;
    }

    if (!pendingJoinRoomId) return;
    const roomId = pendingJoinRoomId;

    joinRoomModal.classList.add('hidden');
    myNickname = nickname;

    if (isFirebaseAvailable && db) {
      const roomRef = db.ref(`rooms/${roomId}`);
      roomRef.get().then((snapshot) => {
        const room = snapshot.val();
        if (!room) {
          alert('존재하지 않거나 삭제된 채팅방입니다.');
          return;
        }
        if (room.memberCount >= 2) {
          alert('정원이 초과되었습니다.');
          return;
        }

        // Increment member count
        roomRef.child('memberCount').set(2).then(() => {
          enterChatRoom(roomId, room.title, room.creator, nickname);
        });
      }).catch(err => {
        fallbackJoinLocal(roomId, nickname);
      });
    } else {
      fallbackJoinLocal(roomId, nickname);
    }
  }

  function fallbackJoinLocal(roomId, nickname) {
    if (localRooms[roomId]) {
      localRooms[roomId].memberCount = 2;
      enterChatRoom(roomId, localRooms[roomId].title, localRooms[roomId].creator, nickname);
    }
  }

  // --------------------------------------------------------------------------
  // Enter & Switch View to Chat Room
  // --------------------------------------------------------------------------
  function enterChatRoom(roomId, title, creator, nickname) {
    currentRoomId = roomId;
    currentRoomTitle.textContent = title;
    currentRoomCreator.textContent = creator;
    currentUserNickname.textContent = nickname;

    messagesContainer.innerHTML = '';

    // Switch View
    listView.classList.add('hidden');
    chatView.classList.remove('hidden');

    // Subscribe to messages
    initMessagesListener(roomId);
  }

  // --------------------------------------------------------------------------
  // Realtime Messaging (FEAT-04)
  // --------------------------------------------------------------------------
  function initMessagesListener(roomId) {
    if (messagesListener && db) {
      db.ref(`rooms/${currentRoomId}/messages`).off('child_added', messagesListener);
    }

    if (isFirebaseAvailable && db) {
      const messagesRef = db.ref(`rooms/${roomId}/messages`);
      messagesListener = messagesRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (msg) {
          renderMessage(msg);
        }
      });
    }
  }

  function handleSendMessage(e) {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !currentRoomId) return;

    messageInput.value = '';

    const msgData = {
      sender: myNickname,
      content: content,
      timestamp: Date.now()
    };

    if (isFirebaseAvailable && db) {
      db.ref(`rooms/${currentRoomId}/messages`).push(msgData)
        .catch(() => {
          // Fallback UI render if offline
          renderMessage(msgData);
        });
    } else {
      renderMessage(msgData);
    }
  }

  function renderMessage(msg) {
    const isMine = msg.sender === myNickname;

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isMine ? 'mine' : 'other'}`;

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    wrapper.innerHTML = `
      ${!isMine ? `<div class="sender-nickname">${escapeHTML(msg.sender)}</div>` : ''}
      <div class="message-bubble">${escapeHTML(msg.content)}</div>
      <div class="message-time">${timeStr}</div>
    `;

    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // --------------------------------------------------------------------------
  // Room Leave & Auto Cleanup (FEAT-05)
  // --------------------------------------------------------------------------
  function handleLeaveRoom() {
    if (!currentRoomId) return;

    if (confirm('채팅방에서 나갈까요?')) {
      const roomIdToLeave = currentRoomId;
      currentRoomId = null;

      decrementRoomMember(roomIdToLeave);

      // Return to List View
      chatView.classList.add('hidden');
      listView.classList.remove('hidden');
    }
  }

  function decrementRoomMember(roomId) {
    if (isFirebaseAvailable && db) {
      const roomRef = db.ref(`rooms/${roomId}`);
      roomRef.child('memberCount').transaction((currentCount) => {
        if (currentCount === null) return 0;
        return currentCount - 1;
      }, (error, committed, snapshot) => {
        if (committed) {
          const newCount = snapshot.val();
          if (newCount <= 0) {
            // Delete room if 0 members
            roomRef.remove();
          }
        }
      });
    } else {
      if (localRooms[roomId]) {
        localRooms[roomId].memberCount -= 1;
        if (localRooms[roomId].memberCount <= 0) {
          delete localRooms[roomId];
        }
        renderRoomGrid(localRooms);
      }
    }
  }

  // Helper Utils
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
