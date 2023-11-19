class User {
    constructor(name, x, y) {
        this.alive = false
        this.name = name
        this.cells = []
        this.room = null
        this.message = []
    }

    update(cells) {
        this.cells = cells
    }
}

module.exports = User
