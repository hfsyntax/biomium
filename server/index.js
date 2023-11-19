var PORT = process.env.PORT || 1337
const User = require('./user')
    , io   = require('socket.io')(PORT)

let users = {}
let rooms = {}
let messages = []


io.on('connection', socket => {
    console.log("someone connected")

    let user = new User('unknown', 0, 0)

    if (!rooms[user.room]) {
        rooms[user.room] = {}
        rooms[user.room][socket.id] = user
    }
    else {
        rooms[user.room][socket.id] = user
    }

    socket.playersInterval = setInterval(() => {
        socket.emit('players', rooms[user.room])
    })

    socket.on('chatMsg', data => {
        user.message = data
    })
    
    socket.on('room', room => {
        if (!room || typeof room != 'string') {
            console.log('invalid data on room')
            return
        }

        if (user.room != room) {
            user.room = room

            console.log('someone joined room', room)
        }
        else {
            console.log('room is the same :thinking:')
        }
    })

    socket.on('spawn', (name, cells) => {
        if (!cells || user.alive) {
            console.log('invalid data on spawn')
            return
        }
        
        user.name = name
        user.cells = cells

        user.alive = true

        users[socket.id] = user

        if (!rooms[user.room]) {
            rooms[user.room] = {}
            rooms[user.room][socket.id] = user
        }
        else {
            rooms[user.room][socket.id] = user
        }

        console.log(`there are now ${Object.keys(users).length} users`)
    })

    socket.on('death', () => {
        if (!user.alive) {
            console.log('invalid data on death')
            return
        }

        user.alive = false

        delete users[socket.id]

        if (rooms[user.room]) delete rooms[user.room][socket.id]

        console.log('someone died')
        console.log(`there are now ${Object.keys(users).length} users`)
    })

    socket.on('cells', (cells, error) => {
        if (!cells || !user.alive) {
            console.log('invalid data on cells')
            return error('invalid data on cells') // in case anything fails
        }

        console.log('received cells', cells)

        user.cells = cells
    })

    socket.on('disconnect', () => {
        clearInterval(socket.playersInterval)

        delete users[socket.id]

        socket.leave(user.room)

        if (rooms[user.room]) delete rooms[user.room][socket.id]

        console.log('someone left room', user.room)

        console.log('someone disconnected')
        console.log(`there are now ${Object.keys(users).length} users`)
    })
})
