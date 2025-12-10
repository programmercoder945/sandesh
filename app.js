import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as crypto from './crypto.js'

const supabaseUrl = 'https://oxbdctocjpvtrdgoacpe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94YmRjdG9janB2dHJkZ29hY3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTIwMzEsImV4cCI6MjA4MDg2ODAzMX0.48UmOXbkXpLaKuvhnWWp_1i9J8-0wvQl-Ppmz-e9tKA'
const supabase = createClient(supabaseUrl, supabaseKey)

let currentUser = null
let currentChatId = null
let aesKey = null

const loginBtn = document.getElementById('login-btn')
const mainUI = document.getElementById('main-ui')
const loginDiv = document.getElementById('login')
const messagesDiv = document.getElementById('messages')
const sendBtn = document.getElementById('send-btn')
const newMessage = document.getElementById('new-message')
const chatList = document.getElementById('chat-list')
const communitiesList = document.getElementById('communities-list')
const channelsList = document.getElementById('channels-list')

// Login / Signup
loginBtn.onclick = async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  let { user, error } = await supabase.auth.signInWithPassword({ email, password })
  if(error){
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    user = data.user
    if(signUpError) { alert(signUpError.message); return }
  }
  currentUser = user
  loginDiv.style.display = 'none'
  mainUI.style.display = 'block'
  aesKey = await crypto.generateKeyPair() // simple skeleton for per-user key
  loadCommunities()
}

// Load communities
async function loadCommunities() {
  const { data: communities } = await supabase.from('communities').select('*')
  communitiesList.innerHTML = ''
  communities.forEach(c => {
    const btn = document.createElement('button')
    btn.textContent = c.title
    btn.onclick = () => loadChannels(c.id)
    communitiesList.appendChild(btn)
  })
}

// Load channels
async function loadChannels(communityId) {
  const { data: channels } = await supabase.from('channels').select('*').eq('community_id', communityId)
  channelsList.innerHTML = ''
  channels.forEach(ch => {
    const btn = document.createElement('button')
    btn.textContent = ch.title
    btn.onclick = () => openChat(ch.id)
    channelsList.appendChild(btn)
  })
}

// Open chat (channel or 1-1)
async function openChat(chatId) {
  currentChatId = chatId
  messagesDiv.innerHTML = ''

  // Realtime subscription for messages
  supabase.from(`messages:chat_id=eq.${chatId}`).on('INSERT', payload => {
    displayMessage(payload.new)
  }).subscribe()

  // Load existing messages
  const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chatId)
  msgs.forEach(displayMessage)
}

// Display message (decrypt skeleton)
function displayMessage(msg) {
  const div = document.createElement('div')
  div.textContent = msg.content // replace with decryptAES when implementing
  messagesDiv.appendChild(div)
  messagesDiv.scrollTop = messagesDiv.scrollHeight
}

// Send message
sendBtn.onclick = async () => {
  if(!currentChatId) return
  const content = newMessage.value // replace with encryptAES
  await supabase.from('messages').insert([{ chat_id: currentChatId, sender: currentUser.id, content }])
  newMessage.value = ''
}
