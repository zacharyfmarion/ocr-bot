const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
var fs = require('fs')
const Tesseract = require('tesseract.js')
var app = express()

const PORT = process.env.PORT || 8445;

app.set('port', (process.env.PORT || 8000));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'test') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
  console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {
  messaging_events = req.body.entry[0].messaging
  for (i = 0; i < messaging_events.length; i++) {
    console.log("we have a messaging event!")
    event = req.body.entry[0].messaging[i]
    console.log(event)
    sender = event.sender.id
    if (event.message) {
      const {text, attachments} = event.message;
      if (attachments) {
        const file = attachments[0]
        // recognise stuff with tesseract
        if (file.type == 'image') {
          sendTextMessage(sender, 'Queing the recognition job...') 
          const path = __dirname = '/tmp/image'
          downloadImage(file.payload.url, path, () => {
            Tesseract.recognize(path)
              .progress(message => console.log(message))
              .catch(err => console.error(err))
              .then(result => {
                sendMultipleMessages(sender, result.text) 
              })
              .finally(resultOrError => console.log(resultOrError))
          })   
        } else {
          sendTextMessage(sender, 'We only accept image files') 
        }
      } else {
        sendTextMessage(sender, 'Please only send image attachments')
      }
    }
  }
  res.sendStatus(200)
})

// get the messenger token
var token = process.env.token 

/** 
 * Break up message into multiple messages if it 
 * is longer than 320 characters
 * @param {String} sender - The id of the sender
 * @param {String} text - The text to send
 */
function sendMultipleMessages(sender, text) {
  let messages = [] 
  while (text.length > 320) {
    messages.push(text.substring(0, 320))
    text = text.substring(320)
  } 
  messages.push(text) 
  messages.forEach(message => sendTextMessage(sender, message))
}

/**
 * Send a text message to a messager user
 * @param {String} sender - The id of the sender
 * @param {String} text - The text to send
 */
function sendTextMessage(sender, text) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: { text },
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

/**
 * Function to download an image
 * @param {String} uri - The uri of the image to download
 * @param {String} filename - The name of the file to be written
 * @param {Function} callback - Function to be run on completion
 */
function downloadImage(uri, path, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type'])
    console.log('content-length:', res.headers['content-length'])
    request(uri).pipe(fs.createWriteStream(path)).on('close', callback)
  });
};
