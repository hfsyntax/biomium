// ==UserScript==
// @name         Biomium
// @version      1.6.0
// @description  Extension for biome3d.com
// @author       Noah Kaiser
// @match        *://*.biome3d.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.4/socket.io.js
// @require      https://code.jquery.com/jquery-3.2.1.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-minicolors/2.3.4/jquery.minicolors.min.js
// ==/UserScript==

let server = unsafeWindow.location.host.split(".")[0]
let proceed = true
let socket
let interval
let alive = false
let map
let fog = true
let floor = true
let isInputting = false
let showPanel = false
let players = {}
const isConnected = () => (socket && socket.connected)

function Reader(e) {
    var t = !0
        , s = 0
        , i = new DataView(e);
    return {
        eof: function () {
            return s >= i.byteLength
        },
        canRead: function (e) {
            return s + e <= i.byteLength
        },
        read: function (e, a) {
            var r = "get" + (a ? "Uint" : "Int") + 8 * e
                , n = i[r](s, t);
            return s += e,
                n
        },
        readArray: function (e, a, r) {
            for (var n = "get" + (r ? "Uint" : "Int") + 8 * a, o = [], h = 0; e > h && this.canRead(a); h++)
                o.push(i[n](s, t)),
                    s += a;
            return o
        },
        readAll: function (e, a) {
            for (var r = "get" + (a ? "Uint" : "Int") + 8 * e, n = []; this.canRead(e);)
                n.push(i[r](s, t)),
                    s += e;
            return n
        }
    }
}

function Writer(e) {
    function t(e) {
        if (e + n > i) {
            i = 2 * i;
            var t = new ArrayBuffer(i);
            new Uint8Array(t).set(new Uint8Array(a)),
                a = t,
                r = new DataView(a)
        }
    }
    var s = !0
        , i = e || 32
        , a = new ArrayBuffer(i)
        , r = new DataView(a)
        , n = 0;
    return {
        writeArray: function (e, i, a) {
            var o = "set" + (a ? "Uint" : "Int") + 8 * i;
            for (var h in e)
                t(i),
                    r[o](n, e[h], s),
                    n += i
        },
        write: function (e, i, a) {
            var o = "set" + (a ? "Uint" : "Int") + 8 * i;
            t(i),
                r[o](n, e, s),
                n += i
        },
        getArrayBuffer: function () {
            return a.slice(0, n)
        }
    }
}

if (!unsafeWindow.location.hostname.match(/\.biome3d\.com/)) {
    console.log("no server")
    proceed = false
}

WebSocket.prototype.origSend = WebSocket.prototype.send

WebSocket.prototype.send = function (evt) {
    this.origSend(evt)
}

function move() {
    if (isConnected() && game.world.players[game.uid]) {
        let player = game.world.players[game.uid]
        socket.emit('cells', player.objs)
    }
}

function getSector(x, y) {
    const HEIGHT = 5000;
    const ROWS = ['1', '2', '3', '4', '5'];
    const COLUMNS = ['A', 'B', 'C', 'D', 'E'];
    const colScale = Math.floor(HEIGHT / ROWS.length);
    const col = Math.floor(y / colScale);
    const row = Math.floor(x / colScale);
    return `${COLUMNS[col]}${ROWS[row]}`;
}

function shortenNames() {
    setInterval(() => {
        if (document.querySelectorAll(".topname").length) {
            const topname = document.querySelectorAll(".topname")
            for (let i = 0; i < topname.length; i++) {
                let emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g
                let spaceRegex = /\s\s+/g
                let blankRegex = /\s/g
                let nspRegex = String.fromCharCode(160)
                if (topname[i].innerHTML.match(emojiRegex)) {
                    topname[i].style.fontSize = "12px"
                }
                else {
                    topname[i].style.fontSize = "16px"
                }
                topname[i].innerHTML.replace(`${spaceRegex}`, ' ')
                topname[i].innerHTML.replace(`${blankRegex}`, 'noname')
                topname[i].innerHTML.replace(`${nspRegex}`, 'noname')
            }
        }
    }, 100)
}

function getPlayers() {
    if (document.querySelector("#startpanel")) {
        let playerCount = document.querySelector("#startpanel > div.left > span > span:nth-child(2)")
        return playerCount.innerHTML
    }
} setInterval(getPlayers, 100)

function getMass() {
    if (game.world.players) {
        let mass = 0
        let player = game.world.players[game.uid]
        if (player && player.objs) {
            for (let j = 0; j < player.objs.length; j++) {
                mass += player.objs[j].m

            }
            return mass
        }
    }
}

function toDataURL(url, callback) {
    var xhr = new XMLHttpRequest()
    xhr.onload = function () {
        var reader = new FileReader()
        reader.onloadend = function () {
            callback(reader.result)
        }
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url)
    xhr.responseType = 'blob'
    xhr.send()
}

function abbreviateNumber(value) {
    var newValue = value;
    if (value >= 1000) {
        var suffixes = ["", "k", "m", "b", "t"];
        var suffixNum = Math.floor(("" + value).length / 3);
        var shortValue = '';
        for (var precision = 2; precision >= 1; precision--) {
            shortValue = parseFloat((suffixNum != 0 ? (value / Math.pow(1000, suffixNum)) : value).toPrecision(precision));
            var dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g, '');
            if (dotLessShortValue.length <= 2) { break; }
        }
        newValue = shortValue + suffixes[suffixNum];
    }
    return newValue;
}

unsafeWindow.addEventListener('wheel', zoom);
let gameZoom = false
function zoom(event) {
    if (gameZoom === true) {
        let delta
        if (event.wheelDelta)
            delta = event.wheelDelta;
        else
            delta = -1 * event.deltaY

        if (delta < 0) {
            if (game.world.camera.fov >= 170) return

            game.world.camera.fov += 10
            game.world.camera.updateProjectionMatrix()
        }
        else if (delta > 0) {
            if (game.world.camera.fov <= 30) return

            game.world.camera.fov -= 10
            game.world.camera.updateProjectionMatrix()
        }
    }
}

function elemToString(elem) {
    return elem.outerHTML
}

let splitKey = localStorage.getItem('split-key')
let doubleKey = localStorage.getItem('dsplit-key') || 81
let maxKey = localStorage.getItem('msplit-key') || 16
let respawnKey = localStorage.getItem('respawn-key') || 82
let navKey = localStorage.getItem('nav-key') || 27

var keyboardMap = [
    "", // [0]
    "", // [1]
    "", // [2]
    "CANCEL", // [3]
    "", // [4]
    "", // [5]
    "HELP", // [6]
    "", // [7]
    "BACK_SPACE", // [8]
    "TAB", // [9]
    "", // [10]
    "", // [11]
    "CLEAR", // [12]
    "ENTER", // [13]
    "ENTER_SPECIAL", // [14]
    "", // [15]
    "SHIFT", // [16]
    "CONTROL", // [17]
    "ALT", // [18]
    "PAUSE", // [19]
    "CAPS_LOCK", // [20]
    "KANA", // [21]
    "EISU", // [22]
    "JUNJA", // [23]
    "FINAL", // [24]
    "HANJA", // [25]
    "", // [26]
    "ESCAPE", // [27]
    "CONVERT", // [28]
    "NONCONVERT", // [29]
    "ACCEPT", // [30]
    "MODECHANGE", // [31]
    "SPACE", // [32]
    "PAGE_UP", // [33]
    "PAGE_DOWN", // [34]
    "END", // [35]
    "HOME", // [36]
    "LEFT", // [37]
    "UP", // [38]
    "RIGHT", // [39]
    "DOWN", // [40]
    "SELECT", // [41]
    "PRINT", // [42]
    "EXECUTE", // [43]
    "PRINTSCREEN", // [44]
    "INSERT", // [45]
    "DELETE", // [46]
    "", // [47]
    "0", // [48]
    "1", // [49]
    "2", // [50]
    "3", // [51]
    "4", // [52]
    "5", // [53]
    "6", // [54]
    "7", // [55]
    "8", // [56]
    "9", // [57]
    "COLON", // [58]
    "SEMICOLON", // [59]
    "LESS_THAN", // [60]
    "EQUALS", // [61]
    "GREATER_THAN", // [62]
    "QUESTION_MARK", // [63]
    "AT", // [64]
    "A", // [65]
    "B", // [66]
    "C", // [67]
    "D", // [68]
    "E", // [69]
    "F", // [70]
    "G", // [71]
    "H", // [72]
    "I", // [73]
    "J", // [74]
    "K", // [75]
    "L", // [76]
    "M", // [77]
    "N", // [78]
    "O", // [79]
    "P", // [80]
    "Q", // [81]
    "R", // [82]
    "S", // [83]
    "T", // [84]
    "U", // [85]
    "V", // [86]
    "W", // [87]
    "X", // [88]
    "Y", // [89]
    "Z", // [90]
    "OS_KEY", // [91] Windows Key (Windows) or Command Key (Mac)
    "", // [92]
    "CONTEXT_MENU", // [93]
    "", // [94]
    "SLEEP", // [95]
    "NUMPAD0", // [96]
    "NUMPAD1", // [97]
    "NUMPAD2", // [98]
    "NUMPAD3", // [99]
    "NUMPAD4", // [100]
    "NUMPAD5", // [101]
    "NUMPAD6", // [102]
    "NUMPAD7", // [103]
    "NUMPAD8", // [104]
    "NUMPAD9", // [105]
    "MULTIPLY", // [106]
    "ADD", // [107]
    "SEPARATOR", // [108]
    "SUBTRACT", // [109]
    "DECIMAL", // [110]
    "DIVIDE", // [111]
    "F1", // [112]
    "F2", // [113]
    "F3", // [114]
    "F4", // [115]
    "F5", // [116]
    "F6", // [117]
    "F7", // [118]
    "F8", // [119]
    "F9", // [120]
    "F10", // [121]
    "F11", // [122]
    "F12", // [123]
    "F13", // [124]
    "F14", // [125]
    "F15", // [126]
    "F16", // [127]
    "F17", // [128]
    "F18", // [129]
    "F19", // [130]
    "F20", // [131]
    "F21", // [132]
    "F22", // [133]
    "F23", // [134]
    "F24", // [135]
    "", // [136]
    "", // [137]
    "", // [138]
    "", // [139]
    "", // [140]
    "", // [141]
    "", // [142]
    "", // [143]
    "NUM_LOCK", // [144]
    "SCROLL_LOCK", // [145]
    "WIN_OEM_FJ_JISHO", // [146]
    "WIN_OEM_FJ_MASSHOU", // [147]
    "WIN_OEM_FJ_TOUROKU", // [148]
    "WIN_OEM_FJ_LOYA", // [149]
    "WIN_OEM_FJ_ROYA", // [150]
    "", // [151]
    "", // [152]
    "", // [153]
    "", // [154]
    "", // [155]
    "", // [156]
    "", // [157]
    "", // [158]
    "", // [159]
    "CIRCUMFLEX", // [160]
    "EXCLAMATION", // [161]
    "DOUBLE_QUOTE", // [162]
    "HASH", // [163]
    "DOLLAR", // [164]
    "PERCENT", // [165]
    "AMPERSAND", // [166]
    "UNDERSCORE", // [167]
    "OPEN_PAREN", // [168]
    "CLOSE_PAREN", // [169]
    "ASTERISK", // [170]
    "PLUS", // [171]
    "PIPE", // [172]
    "HYPHEN_MINUS", // [173]
    "OPEN_CURLY_BRACKET", // [174]
    "CLOSE_CURLY_BRACKET", // [175]
    "TILDE", // [176]
    "", // [177]
    "", // [178]
    "", // [179]
    "", // [180]
    "VOLUME_MUTE", // [181]
    "VOLUME_DOWN", // [182]
    "VOLUME_UP", // [183]
    "", // [184]
    "", // [185]
    "SEMICOLON", // [186]
    "EQUALS", // [187]
    "COMMA", // [188]
    "MINUS", // [189]
    "PERIOD", // [190]
    "SLASH", // [191]
    "BACK_QUOTE", // [192]
    "", // [193]
    "", // [194]
    "", // [195]
    "", // [196]
    "", // [197]
    "", // [198]
    "", // [199]
    "", // [200]
    "", // [201]
    "", // [202]
    "", // [203]
    "", // [204]
    "", // [205]
    "", // [206]
    "", // [207]
    "", // [208]
    "", // [209]
    "", // [210]
    "", // [211]
    "", // [212]
    "", // [213]
    "", // [214]
    "", // [215]
    "", // [216]
    "", // [217]
    "", // [218]
    "OPEN_BRACKET", // [219]
    "BACK_SLASH", // [220]
    "CLOSE_BRACKET", // [221]
    "QUOTE", // [222]
    "", // [223]
    "META", // [224]
    "ALTGR", // [225]
    "", // [226]
    "WIN_ICO_HELP", // [227]
    "WIN_ICO_00", // [228]
    "", // [229]
    "WIN_ICO_CLEAR", // [230]
    "", // [231]
    "", // [232]
    "WIN_OEM_RESET", // [233]
    "WIN_OEM_JUMP", // [234]
    "WIN_OEM_PA1", // [235]
    "WIN_OEM_PA2", // [236]
    "WIN_OEM_PA3", // [237]
    "WIN_OEM_WSCTRL", // [238]
    "WIN_OEM_CUSEL", // [239]
    "WIN_OEM_ATTN", // [240]
    "WIN_OEM_FINISH", // [241]
    "WIN_OEM_COPY", // [242]
    "WIN_OEM_AUTO", // [243]
    "WIN_OEM_ENLW", // [244]
    "WIN_OEM_BACKTAB", // [245]
    "ATTN", // [246]
    "CRSEL", // [247]
    "EXSEL", // [248]
    "EREOF", // [249]
    "PLAY", // [250]
    "ZOOM", // [251]
    "", // [252]
    "PA1", // [253]
    "WIN_OEM_CLEAR", // [254]
    "" // [255]
];


function hotkeyConfig() {
    splitKey = null; localStorage.setItem('split-key', splitKey); document.getElementById('x1split-input').value = ""; localStorage.setItem('split-key-value', document.getElementById('x1split-input').value)
    doubleKey = 81; localStorage.setItem('dsplit-key', doubleKey); document.getElementById('x2split-input').value = keyboardMap[doubleKey]; localStorage.setItem('dsplit-key-value', keyboardMap[doubleKey])
    maxKey = 16; localStorage.setItem('msplit-key', maxKey); document.getElementById('x16split-input').value = keyboardMap[maxKey]; localStorage.setItem('msplit-key-value', keyboardMap[maxKey])
    respawnKey = 82; localStorage.setItem('respawn-key', respawnKey); document.getElementById('respawn-input').value = keyboardMap[respawnKey]; localStorage.setItem('respawn-key-value', keyboardMap[respawnKey])
    navKey = 27; localStorage.setItem('nav-key', navKey); document.getElementById('tnav-input').value = keyboardMap[navKey]; localStorage.setItem('nav-key-value', keyboardMap[navKey])
    //chatKey = 90; localStorage.setItem('chat-key', chatKey);  document.getElementById('chatKey-input').value = keyboardMap[chatKey]; localStorage.setItem('chat-key-value', keyboardMap[chatKey])
}

function hkSetMode(mode) {

    unsafeWindow.game.mode = mode
    unsafeWindow.game.onMode && unsafeWindow.game.onMode(mode)

    setTimeout(() => {
        if (mode == 2) {
            alive = true
            showPanel = false
            document.getElementById('biomium-tag').disabled = true
            document.getElementById('play-button').disabled = true
            document.getElementById('name-input').disabled = true
            document.getElementById('teammates').style.display = 'block'
            setInterval(() => {
                if (document.getElementById('startpanel').style.display == 'block') gameZoom = false
                else if (document.getElementById('startpanel').style.display == 'none') gameZoom = true
            }, 100);

            if (isConnected()) {
                let player = game.world.players[game.uid]
                if (!player) return
                socket.emit('spawn', player.name, player.objs)
                interval = setInterval(move, 100)
            }
        }
        else if (mode == 1) {
            alive = false
            gameZoom = true
            document.getElementById('startpanel').style.display = 'block'
            document.querySelector('.control-bar').style.display = 'flex'
            document.getElementById('biomium-tag').disabled = false
            document.getElementById('play-button').disabled = false
            document.getElementById('name-input').disabled = false
            document.getElementById('teammates').style.display = 'none'
            if (document.getElementById('ar-switch-e').checked) document.getElementById('play-button').click()
            if (isConnected()) {
                socket.emit('death')
                clearInterval(interval)
            }
        }
    }, 500)
}

function hkRender() {

    let e = game.world.camerapos.x.value
        , s = game.world.camerapos.y.value
        , i = game.world.camerapos.h.value
        , a = game.world.camerapos.yaw.value
        , r = game.world.camerapos.pitch.value
        , n = Math.cos(a) * Math.sin(r) * i
        , o = Math.sin(a) * Math.sin(r) * i
        , h = Math.cos(r) * i;
    game.world.camera.position.set(e + .6 * n, .8 * h, s + .6 * o),
        game.world.camera.lookAt(new THREE.Vector3(e - .4 * n, 0, s - .4 * o));
    let l = 2 * game.world.camerapos.h.value;
    game.world.scene.fog.near = .5 * l,
        game.world.scene.fog.far = 1.4 * l
    if (fog == false) {
        game.world.scene.fog.near = 0
        game.world.scene.fog.far = 99999
    }
    game.world.renderer.render(game.world.scene, game.world.camera)

    document.querySelector("#fps > span:nth-child(6)").innerHTML = " | RES: "
    document.querySelector('#fps > span:nth-child(8)').innerHTML = '% ' + ' | Players: ' + getPlayers() + ' | Mass: ' + getMass()

    let map = document.getElementById('biomium-minimap')
    let board_size = 5000
    let mapContext = map.getContext('2d')
    mapContext.fillStyle = document.getElementById('map-theme-e').value
    mapContext.fillRect(0, 0, board_size, board_size)
    if (document.getElementById('hml-switch-e').checked === true) {
        let hl = 40
        let vl = 40

        mapContext.beginPath();
        mapContext.strokeStyle = document.getElementById('mapl-theme-e').value
        mapContext.lineWidth = 0.2;

        for (let i = 0; i < 4; i++) {
            mapContext.moveTo(200.5, vl + .5);
            mapContext.lineTo(0.5, vl + .5);
            vl += 40
            mapContext.moveTo(hl + .5, 205.5);
            mapContext.lineTo(hl + .5, 0.5);
            hl += 40
        }

        mapContext.stroke();
        mapContext.closePath();
    }

    if (document.getElementById('hms-switch-e').checked === true) {
        let sectors = ["A", "B", "C", "D", "E"]
        mapContext.font = "600 15px Arial";
        mapContext.fillStyle = document.getElementById('maps-theme-e').value
        mapContext.save()
        mapContext.translate(10, 26)

        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                mapContext.fillText(sectors[i] + (j + 1), j * 40, i * 40);
            }
        }
        mapContext.restore()
    }

    document.querySelector("#teammates-top5").innerHTML = ""
    for (let player in players) {
        let plr = players[player]
        let totalMass = 0
        let name
        let centerX
        let centerY

        for (let i = 0; i < plr.cells.length; i++) {

            totalMass += plr.cells[i].m

            let px = plr.cells[0].x / board_size * map.width
            let py = plr.cells[0].y / board_size * map.height

            mapContext.fillStyle = document.getElementById('mapd-theme-e').value
            mapContext.beginPath()
            mapContext.arc(px, py, 5, 0, 2 * Math.PI)
            mapContext.stroke()
            mapContext.fill()
            mapContext.closePath()


            if (document.getElementById('hmn-switch-e').checked === true) {
                mapContext.fillStyle = document.getElementById('mapn-theme-e').value
                mapContext.font = 'bold 12px Arial'
                name = plr.name
                if (!name) plr.name = ""
                let centerText = mapContext.measureText(name).width
                centerY = py - 10
                centerX = px - (centerText / 2)
            }

        }

        mapContext.fillText(name, centerX, centerY)
        if (alive) {
            document.querySelector("#sector-location").innerHTML = getSector(plr.cells[0].x, plr.cells[0].y)
            document.querySelector("#teammates-top5").innerHTML += `<li><i class="fas fa-map-marker-alt">[${getSector(plr.cells[0].x, plr.cells[0].y)}]</i><i class="far fa-dot-circle">[${totalMass}]</i>${plr.name}</li></br>`
        }

    }

}

const waitForLeaderboardRender = async () => {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            if (document.getElementsByClassName("toprow")) {
                const toprow = document.getElementsByClassName("toprow")
                if (toprow[0])
                    resolve()
            }

        }, 100);
        setTimeout(() => {
            reject("Leaderboard did not render in time.")
        }, 10000);
    })
}

const removeBloatware = () => {
    while (Array.from(document.scripts).some(script => !script.src.includes("cloudflare") && !script.src.includes(window.location.href))) {
        for (let script of document.scripts) {
            if (!script.src.includes("cloudflare") && !script.src.includes(window.location.href)) {
                script.parentNode.removeChild(script)
            }
        }
    }

    const ads = document.querySelectorAll(".adsbygoogle")
    
    for (let ad of ads) {
        ad.parentNode.removeChild(ad)
    }
}

if (proceed) {
    const init = async () => {
        await waitForLeaderboardRender()
        removeBloatware()
        console.log(`finished removing bloatware, there is now ${document.scripts.length} scripts...`)
        
        console.log(`JQuery loaded: ${window.jQuery}`)
        console.log(`minicolors loaded: ${$.fn.minicolors}`)
        console.log(`
    __________.__               .__
    \\______   \\__| ____   _____ |__|__ __  _____
     |    |  _/  |/  _ \\ /     \\|  |  |  \\/     \\
     |    |   \\  (  <_> )  Y Y  \\  |  |  /  Y Y  \\
     |______  /__|\\____/|__|_|  /__|____/|__|_|  /
            \\/                \\/               \\/ 
`);


        const startpanel = document.querySelector('#startpanel')
        startpanel.className = 'tabcontent'
        document.querySelector("head > link:nth-child(7)").href = "https://hfsyntax.github.io/biomium/client/biome3d.css"
        document.querySelector("head > link:nth-child(8)").href = 'https://i.imgur.com/dnVcf56.png'
        document.title = "Biomium"
        document.querySelector("#game > div.top > div > center").innerHTML = "Biomium"
        document.querySelector(".panel").style.display = "block"
        document.querySelector("#startpanel > input[type=text]").className = "inputs"
        document.querySelector("#startpanel > input[type=text]").id = "name-input"
        document.querySelector("#startpanel > select").className = "inputs"
        document.querySelector("#startpanel > select").id = "skin-select"


        $('#game').append(`
            <div class="welcome-message">[Biomium] Connected </div><div id='minimap-container'><span id='sector-location'>null</span><canvas id="biomium-minimap" width="200" height="200"></canvas></div><div id='teammates'><span id='teammates-title'>Teammates:</span><br></br><ol id='teammates-top5'></ol></div><div class="control-bar"><div class="buttons"><div class="button left" id="home-menu" onclick="openTab(event, 'startpanel')"><div class="inner"><div class="icon"><i class="fas fa-home"></i></div><div class="label">Home</div></div></div><div class="button dummy"></div><div class="button right one" id="theme-menu"onclick="openTab(event, 'themepanel')"><div class="inner"><div class="icon"><i class="fas fa-palette"></i></div><div class="label">Theme</div></div></div><div class="button right two" id="hotkeys-menu"onclick="openTab(event, 'hotkeypanel')"><div class="inner"><div class="icon"><i class="fas fa-keyboard"></i></div><div class="label">Hotkeys</div></div></div><div class="button right three" id="settings-menu"onclick="openTab(event, 'settingspanel')"><div class="inner"><div class="icon"><i class="fas fa-cog"></i></div><div class="label">Settings</div></div></div><div class="button right four" id="changelog-menu"onclick="openTab(event, 'changelog')"><div class="inner"><div class="icon"><i class="fas fa-book"></i></div><div class="label">Changelog</div></div></div></div><div class="skin-preview-circle" id="open-profiles-catalogue"><div class="container"><div class="preview" id="skin-preview-1"></div></div></div></div><div id="themepanel" class="tabcontent"></div><div id="hotkeypanel" class="tabcontent"></div><div id="settingspanel" class="tabcontent"></div><div id="changelog" class="tabcontent"></div><script>;function openTab(n,l){var e,a,t;a=document.getElementsByClassName('tabcontent');for(e=0;e<a.length;e++){a[e].style.display='none'};t=document.getElementsByClassName('tablinks');for(e=0;e<t.length;e++){t[e].className=t[e].className.replace(' active','')};document.getElementById(l).style.display='block';n.currentTarget.className+=' active'};document.getElementById('home-menu').click();</script>
        `)

        $(".top").append(`<div id="currentTime"></div>`)

        $("#startpanel").append(`
            <i class="fas fa-eye" id="toggle-skinURL" style="color: white; position: absolute; top: 10px; left: 10px;"></i> <input class='inputs' id="biomium-tag" placeholder="Tag" maxlength="4" spellcheck="false" autocomplete="false"></input><select class='inputs' id="reigon"><option value="http://us.biome3d.com/">us</option><option value="http://eu.biome3d.com/">eu</option><option value="http://eu2.biome3d.com/">eu2</option><option value="http://asia.biome3d.com/">asia</option></select>
        `)

        $("#themepanel").append(`
            <select class="inputs" id="premade-themes"> <option disabled selected="true">Custom/Default</option> <option>Light</option> <option>Dark</option> <option>High Fuel</option> <option>Ogar</option> </select> <button class="reset" id="reset-theme-btn">Reset Theme</button> <div class="theme-titles" id='tt1'> <u><span>UI</span></u> </div> <div class='theme-input-container-left' id='nav-theme'> <label >NAV</label> <input type="text" class="demo" id='nav-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='navb-theme'> <label >NAV-bar</label> <input type="text" class="demo" id='navb-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='navi-theme'> <label >NAV-bar icons</label> <input type="text" class="demo" id='navi-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='nava-theme'> <label >NAV-bar text</label> <input type="text" class="demo" id='nava-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='navin-theme'> <label >NAV inputs</label> <input type="text" class="demo" id='navin-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='navt-theme'> <label >NAV text</label> <input type="text" class="demo" id='navt-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='navp-theme'> <label >Play button</label> <input type="text" class="demo" id='navp-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='navsp-theme'> <label >Skin preview</label> <input type="text" class="demo" id='navsp-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <input type="text" class="inputs" id='pi-theme' placeholder="NAV image URL" spellcheck="false"> <div class="theme-titles" id='tt2'> <u><span>Game Stats</span></u> </div> <div class='theme-input-container-left' id='gi-theme'> <label >Information</label> <input type="text" class="demo" id='gi-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='git-theme'> <label >Information Text</label> <input type="text" class="demo" id='git-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='lead-theme'> <label >Leaderboard</label> <input type="text" class="demo" id='lead-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='leadt-theme'> <label >L-Board Title</label> <input type="text" class="demo" id='leadt-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='leadn-theme'> <label >L-Board Names</label> <input type="text" class="demo" id='leadn-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='leadm-theme'> <label >L-Board Mass</label> <input type="text" class="demo" id='leadm-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class="theme-titles" id='tt3'> <u><span>Minimap</span></u> </div> <div class='theme-input-container-left' id='map-theme'> <label >Map</label> <input type="text" class="demo" id='map-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='mapb-theme'> <label >Map Container</label> <input type="text" class="demo" id='mapb-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='mapn-theme'> <label >Map Names</label> <input type="text" class="demo" id='mapn-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='mapd-theme'> <label >Map Dots</label> <input type="text" class="demo" id='mapd-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='mapl-theme'> <label >Map Lines</label> <input type="text" class="demo" id='mapl-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='maps-theme'> <label >Map Sectors</label> <input type="text" class="demo" id='maps-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class="theme-titles" id='tt4'> <u><span>Game UI</span></u> </div> <div class='theme-input-container-left' id='flo-theme'> <label >Floor</label> <input type="text" class="demo" id='flo-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='fog-theme'> <label >Fog</label> <input type="text" class="demo" id='fog-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='food-theme'> <label >Food</label> <input type="text" class="demo" id='food-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='wall-theme'> <label >Walls</label> <input type="text" class="demo" id='wall-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='tree-theme'> <label >Trees</label> <input type="text" class="demo" id='tree-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='trunk-theme'> <label >Tree Trunks</label> <input type="text" class="demo" id='trunk-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class="theme-titles" id='tt5'> <u><span>Teammates/Data</span></u> </div> <div class='theme-input-container-left' id='teamt-theme'> <label >Team Title</label> <input type="text" class="demo" id='teamt-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='teamtxt-theme'> <label >Team Text</label> <input type="text" class="demo" id='teamtxt-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-left' id='teamb-theme'> <label >T-Background</label> <input type="text" class="demo" id='teamb-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div> <div class='theme-input-container-right' id='teamo-theme'> <label >Date/Time</label> <input type="text" class="demo" id='teamo-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div><div class='theme-input-container-left' id='timeb-theme'> <label >Date/Time Text</label> <input type="text" class="demo" id='timeb-theme-e' value="#ff6161" spellcheck="false" style="background: #4c4c4c; color: white; outline: 1px solid #000; border: none; height: 30px;"> </div>
        `)

        $("#hotkeypanel").append(`
                <button class="reset" id="reset-keys-btn">Reset Keys</button> <span class="hk-span" id="x1split-span">Split</span> <span class="hk-span" id="x2split-span">Double Split</span> <span class="hk-span" id="x16split-span">Max Split</span> <span class="hk-span" id="respawn-span">Respawn</span> <span class="hk-span" id="tnav-span">Toggle Nav</span><input class='inputs' id="x1split-input" onfocus="this.value='';"> <input class='inputs' id="x2split-input" onfocus="this.value='';"> <input class='inputs' id="x16split-input" onfocus="this.value=''"> <input class='inputs' id="respawn-input" onfocus="this.value=''"> <input class='inputs' id="tnav-input" onfocus="this.value=''"><div id='default-keys' class="inputs"> <u>Default Keys:</u></br><span>Camera Angle: Arrows or WASD</span></br><span>Camera FOV: Scroll</span></br><span>Cell Movement: Mouse</span></br><span>Game Resolution: -/+</span> </div>
            `)

        $("#settingspanel").append(`
                <button class="reset" id="reset-settings-btn">Reset Settings</button> <div class="theme-titles" id='st1'> <u><span>Game Stats</span></u> </div> <span class="checkbox-span" id="gi-span">Game-Information</span> <span class="checkbox-span" id="mi-span">Game-Info At Top</span> <span class="checkbox-span" id="hl-span">Leaderboard</span> <span class="checkbox-span" id="teammates-span">Teammates Information</span> <span class="checkbox-span" id="sm-span">Short Mass</span> <span class="checkbox-span" id="mass-span">Leaderboard [Mass]</span><span class="checkbox-span" id="time-span">Leaderboard [Time]</span><span class="checkbox-span" id="tre-span">Trees</span> <span class="checkbox-span" id="w-span">Walls</span> <span class="checkbox-span" id="pe-span">Food</span> <span class="checkbox-span" id="fo-span">Fog</span> <span class="checkbox-span" id="til-span">Tiles</span> <span class="checkbox-span" id="on-span">Own Name</span> <span class="checkbox-span" id="oon-span">Opponent Names</span> <span class="checkbox-span" id="os-span">Skins</span> <span class="checkbox-span" id="tra-span">Transparent Cells</span> <span class="checkbox-span" id="ar-span">Auto-Respawn</span> <span class="checkbox-span" id="map-span">Map</span> <span class="checkbox-span" id="hmn-span">Map Names</span> <span class="checkbox-span" id="hms-span">Map Sectors</span> <span class="checkbox-span" id="hml-span">Map Lines</span> <span class="checkbox-span" id="hmmsi-span">Sector Indicator</span> <label class="switch" id='gi-switch'><input type="checkbox" id='gi-switch-e' checked><span class="slider"></span></label> <label class="switch" id='mi-switch'><input type="checkbox" id='mi-switch-e'><span class="slider"></span></label> <label class="switch" id='hl-switch'><input type="checkbox" id="hl-switch-e" checked><span class="slider"></span></label> <label class="switch" id='teammates-switch'><input type="checkbox" id="teammates-switch-e" checked><span class="slider"></span></label> <label class="switch" id='sm-switch'><input type="checkbox" id='sm-switch-e' checked><span class="slider"></span></label><label class="switch" id='time-switch'><input type="checkbox" id='time-switch-e' checked><span class="slider"></span></label><label class="switch" id='mass-switch'><input type="checkbox" id='mass-switch-e' checked><span class="slider"></span></label> <label class="switch" id='tre-switch'><input type="checkbox" id='tre-switch-e'><span class="slider"></span></label> <label class="switch" id='w-switch'><input type="checkbox" id='w-switch-e' checked><span class="slider"></span></label> <label class="switch" id='pe-switch'><input type="checkbox" id='pe-switch-e' checked><span class="slider"></span></label> <label class="switch" id='fo-switch'><input type="checkbox" id='fo-switch-e'><span class="slider"></span></label> <label class="switch" id='til-switch'><input type="checkbox" id='til-switch-e'><span class="slider"></span></label> <label class="switch" id='on-switch'><input type="checkbox" id='on-switch-e' checked><span class="slider"></span></label> <label class="switch" id='oon-switch'><input type="checkbox" id='oon-switch-e' checked><span class="slider"></span></label> <label class="switch" id='os-switch'><input type="checkbox" id='os-switch-e' checked><span class="slider"></span></label> <label class="switch" id='tra-switch'><input type="checkbox" id='tra-switch-e'><span class="slider"></span></label> <label class="switch" id='ar-switch'><input type="checkbox" id='ar-switch-e'><span class="slider"></span></label> <label class="switch" id='map-switch'><input type="checkbox" id='map-switch-e' checked><span class="slider"></span></label> <label class="switch" id='hmn-switch'><input type="checkbox" id='hmn-switch-e' checked><span class="slider"></span></label> <label class="switch" id='hms-switch'><input type="checkbox" id='hms-switch-e' checked><span class="slider"></span></label> <label class="switch" id='hml-switch'><input type="checkbox" id='hml-switch-e' checked><span class="slider"></span></label><label class="switch" id='hmmsi-switch'><input type="checkbox" id='hmmsi-switch-e' checked><span class="slider"></span></label> <div class="theme-titles" id='st2'> <u><span>Game UI</span></u> </div> <div class="theme-titles" id='st3'> <u><span>Helpers</span></u> </div> <div class="theme-titles" id='st4'> <u><span>Minimap</span></u> </div>
        `)

        $("#changelog").append(`
                </br><span style="color: gray; font-size: 25px; font-family: Roboto Condensed; margin:auto; display:table;">9/26/2019</span><hr></br><span class="cl-span"><i class="fas fa-info-circle" style="color: white;"></i> Adjusted disconnect message position</span></br><span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed hotkey matching default input</span></br><span class="cl-span"><i class="far fa-times-circle" style="color: white;"></i> Removed suicide hotkey</span></br><span style="color: gray; font-size: 25px; font-family: Roboto Condensed; margin:auto; display:table;">8/25/2019</span><hr></br><span class="cl-span"><i class="fas fa-info-circle" style="color: white;"></i> Teammates panel now only shows when alive</span></br><span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed skin viewer image dimensions</span></br><span style="color: gray; font-size: 25px; font-family: Roboto Condensed; margin:auto; display:table;">8/23/2019</span><hr></br><span class="cl-span"><i class="fas fa-info-circle" style="color: white;"></i> Changed leaderboard default theme contrast</span></br><span class="cl-span"><i class="fas fa-info-circle" style="color: white;"></i> Changed NAV skin preview</span></br><span class="cl-span"><i class="far fa-times-circle" style="color: white;"></i> Removed custom skins</span></br><span style="color: gray; font-size: 25px; font-family: Roboto Condensed; margin:auto; display:table;">8/17/2019</span><hr></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added map border to map lines theming</span></br><span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed blank hotkeys when changing</span></br> <span style="color: gray; font-size: 25px; font-family: Roboto Condensed; margin:auto; display:table;">8/15/2019</span><hr></br> <span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed premade themes coloring</span></br> <span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed hotkey loading</span><span style="color: gray; font-size: 25px; font-family: Roboto Condensed; margin:auto; display:table;">8/9/2019</span><hr></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> New GUI</span></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added teammates panel</span></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added sector indicator</span></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added shortmass setting</span></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added premade themes</span></br> <span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added global hotkeys</span></br><span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added skin panel</span></br><span class="cl-span"><i class="far fa-check-circle" style="color: white;"></i> Added profile privacy option</span></br> <span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed minimap tag</span></br><span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed leaderboard long-names</span></br><span class="cl-span"><i class="fas fa-wrench" style="color: white;"></i> Fixed same skin on custom skin</span></br> <span class="cl-span"><i class="far fa-times-circle" style="color: white;"></i> Removed minimap cell-outline</span></br> <span class="cl-span"><i class="far fa-times-circle" style="color: white;"></i> Removed minimap mass-headers</span><hr> <span id='disclaimer' style="margin:auto; display:table;">To support/report a bug/contact: </br><a href="https://discord.me/biome3d" target="blank">discord.me/biome3d</a></span>
            `)

        document.getElementById('teammates').style.display = 'none'

        unsafeWindow.game.onSocketClose = function () {
            document.querySelector("#home-menu").click()
        }

        var s = document.querySelector(".welcome-message").style; s.opacity = 1;
        setTimeout(() => { (function fade() { (s.opacity -= .1) < 0 ? s.display = "none" : setTimeout(fade, 50) })() }, 2000);

        let tag = document.getElementById("biomium-tag")
        tag.value = localStorage.getItem("savedTag")
        tag.onchange = function () {
            if (tag.value === "")
                socket.emit("room", "none")
            else
                socket.emit("room", tag.value)

            localStorage.setItem("savedTag", tag.value)
        }

        function checkTime() {
            const div = document.getElementById("currentTime")
            let now = new Date();
            div.innerText = now.toLocaleDateString() + " " + now.toLocaleTimeString()
        }
        setInterval(checkTime, 100)

        shortenNames()


        const reigon = document.getElementById("reigon")
        for (var i = 0, j = reigon.options.length; i < j; ++i) {
            if (reigon.options[i].innerHTML === server) {
                reigon.selectedIndex = i;
                break;
            }
        }

        reigon.onchange = function () {
            window.document.location.href = this.options[this.selectedIndex].value;
        }




        const skinURLVisibility = document.getElementById('toggle-skinURL')
        let isVisible = true
        skinURLVisibility.onclick = function () {
            if (isVisible == true) {
                skinURLVisibility.className = "fas fa-eye-slash"
                //skinURLVisibility.style.color = 'red'
                tag.style.color = "transparent"
                isVisible = false
            } else {
                skinURLVisibility.className = "fas fa-eye"
                //skinURLVisibility.style.color = 'white'
                tag.style.color = localStorage.getItem('navt')
                isVisible = true
            }
        }

        const skinHolder = document.getElementById('open-profiles-catalogue')
        const skinSelect = document.getElementById('skin-select')
        setTimeout(() => {
            skinHolder.style.backgroundImage = 'url(assets/images/skins/' + skinSelect.value + '.jpg)';
        });

        skinSelect.onchange = function () {
            skinHolder.style.backgroundImage = 'url(assets/images/skins/' + skinSelect.value + '.jpg)';
        }

        let navImageInput = document.getElementById('pi-theme')
        navImageInput.value = localStorage.getItem('panel-url')
        navImageInput.onchange = function () {
            setInterval(() => {
                if (startpanel) {
                    let tabs = document.querySelectorAll(".tabcontent")
                    tabs.forEach(tab => tab.style.backgroundImage = "url(" + navImageInput.value + ")");
                    document.getElementById('startpanel').style.backgroundImage = "url(" + navImageInput.value + ")"
                    document.getElementById('premade-themes').value = "Custom/Default"
                    localStorage.setItem('pickerVal', document.getElementById('premade-themes').value)
                    localStorage.setItem("panel-url", navImageInput.value)
                }
            }, 100);
        }

        setInterval(() => {
            if (startpanel) {
                let tabs = document.querySelectorAll(".tabcontent")
                tabs.forEach(tab => tab.style.backgroundImage = "url(" + navImageInput.value + ")");
                document.getElementById('startpanel').style.backgroundImage = "url(" + navImageInput.value + ")"
                localStorage.setItem("panel-url", navImageInput.value)
            }
        }, 100)

        const playButton = document.querySelector("#startpanel > center > button")
        playButton.id = "play-button"
        playButton.onclick = function () {
            document.getElementById('startpanel').style.display = 'none'
            document.querySelector('.control-bar').style.display = 'none'
        }

        document.getElementById('reset-keys-btn').onclick = function () { hotkeyConfig() }
        let single_split = document.getElementById("x1split-input")
        single_split.value = localStorage.getItem('split-key-value')
        single_split.onchange = function () {
            localStorage.setItem('split-key', splitKey)
            localStorage.setItem('split-key-value', single_split.value)

        }
        unsafeWindow.addEventListener("keydown", split, false);
        function split(key) {
            if (isInputting == false && splitKey != doubleKey && splitKey != maxKey && splitKey != respawnKey && splitKey != navKey) {
                if (key.keyCode == splitKey) {
                    let command = new Writer(5);
                    command.write(10, 1);
                    let split = command.getArrayBuffer();
                    for (let i = 0; i < 1; i++) setTimeout(() => game.send(split), 60 * i);
                }
            }
        }
        single_split.onkeyup = function (key) {
            isInputting = true
            splitKey = key.keyCode
            single_split.value = keyboardMap[splitKey]
            setTimeout(() => { isInputting = false }, 1000);
        }
        let double_split = document.getElementById("x2split-input")
        double_split.value = localStorage.getItem('dsplit-key-value') || keyboardMap[doubleKey]
        double_split.onchange = function () {
            localStorage.setItem('dsplit-key', doubleKey)
            localStorage.setItem('dsplit-key-value', double_split.value)

        }
        unsafeWindow.addEventListener("keydown", dsplit, false);
        function dsplit(key) {
            if (isInputting == false && doubleKey != splitKey && doubleKey != maxKey && doubleKey != respawnKey && doubleKey != navKey) {
                if (key.keyCode == doubleKey) {
                    let command = new Writer(5);
                    command.write(10, 1);
                    let split = command.getArrayBuffer();
                    for (let i = 0; i < 2; i++) setTimeout(() => game.send(split), 60 * i);
                }
            }
        }
        double_split.onkeyup = function (key) {
            isInputting = true
            doubleKey = key.keyCode
            double_split.value = keyboardMap[doubleKey]
            setTimeout(() => { isInputting = false }, 1000);
        }
        let max_split = document.getElementById("x16split-input")
        max_split.value = localStorage.getItem('msplit-key-value') || keyboardMap[maxKey]
        max_split.onchange = function () {
            localStorage.setItem('msplit-key', maxKey)
            localStorage.setItem('msplit-key-value', max_split.value)

        }
        unsafeWindow.addEventListener("keydown", msplit, false);
        function msplit(key) {
            if (isInputting == false && maxKey != splitKey && maxKey != doubleKey && maxKey != respawnKey && maxKey != navKey) {
                if (key.keyCode == maxKey) {
                    let command = new Writer(5);
                    command.write(10, 1);
                    let split = command.getArrayBuffer();
                    for (let i = 0; i < 4; i++) setTimeout(() => game.send(split), 60 * i);
                }
            }
        }
        max_split.onkeyup = function (key) {
            isInputting = true
            maxKey = key.keyCode
            max_split.value = keyboardMap[maxKey]
            setTimeout(() => { isInputting = false }, 1000)
        }
        let respawn_input = document.getElementById('respawn-input')
        respawn_input.value = localStorage.getItem('respawn-key-value') || keyboardMap[respawnKey]
        respawn_input.onchange = function () {
            localStorage.setItem('respawn-key', respawnKey)
            localStorage.setItem('respawn-key-value', respawn_input.value)

        }
        unsafeWindow.addEventListener("keydown", respawn, false);
        function respawn(key) {
            if (isInputting == false && alive == true && respawnKey != splitKey && respawnKey != doubleKey && respawnKey != maxKey && respawnKey != navKey) {
                if (key.keyCode == respawnKey) {
                    document.getElementById('play-button').disabled = false
                    document.getElementById('play-button').click()
                }
            }
        }
        respawn_input.onkeyup = function (key) {
            isInputting = true
            respawnKey = key.keyCode
            respawn_input.value = keyboardMap[respawnKey]
            setTimeout(() => { isInputting = false }, 1000)
        }

        let nav_input = document.getElementById('tnav-input')
        nav_input.value = localStorage.getItem('nav-key-value') || keyboardMap[navKey]
        nav_input.onchange = function () {
            localStorage.setItem('nav-key', navKey)
            localStorage.setItem('nav-key-value', nav_input.value)
        }

        function togglePanel() {
            if (!showPanel) {
                showPanel = true;
                startpanel.style.display = 'block'
                document.querySelector('.control-bar').style.display = 'flex'
                return
            }
            document.querySelector('#home-menu').click(); startpanel.style.display = 'none'; document.querySelector('.control-bar').style.display = 'none'; showPanel = false
        }

        togglePanel()

        unsafeWindow.addEventListener("keydown", togglePanelFunc, false);
        function togglePanelFunc(key) {
            if (isInputting == false && alive == true && navKey != splitKey && navKey != doubleKey && navKey != maxKey && navKey != respawnKey) {
                if (key.keyCode == navKey) {
                    togglePanel()
                }

            }
        }
        nav_input.onkeyup = function (key) {
            isInputting = true
            navKey = key.keyCode
            nav_input.value = keyboardMap[navKey]
            setTimeout(() => { isInputting = false }, 1000)
        }

        let wackInputs = [single_split, double_split, max_split, respawn_input, nav_input]
        let wackInputsKeys = ["split-key-value", "dsplit-key-value", "msplit-key-value", "respawn-key-value", "nav-key-value"]
        for (let i = 0; i < wackInputs.length; i++) {
            wackInputs[i].onblur = function () {
                if (wackInputs[i].value === '') {
                    wackInputs[i].value = localStorage.getItem(wackInputsKeys[i])
                    localStorage.setItem(wackInputsKeys[i], wackInputs[i].value)
                } else {
                    wackInputs[i].value = wackInputs[i].value
                    localStorage.setItem(wackInputsKeys[i], wackInputs[i].value)
                }
            }
        }

        unsafeWindow.game.themeSetup = {}
        game.themeSetup.loadNavColor = function () {
            document.getElementById('nav-theme-e').value = localStorage.getItem('pc') || '#191919'
            document.querySelector('#nav-theme > div > span > span').style.backgroundColor = document.getElementById('nav-theme-e').value
            let tabcontent = document.querySelectorAll(".tabcontent")
            let startpanel = document.querySelector("#startpanel")
            tabcontent.forEach(tab => tab.style.background = document.getElementById('nav-theme-e').value)
            startpanel.style.background = document.getElementById('nav-theme-e').value
        }
        game.themeSetup.changeNavColor = function (color) {
            let pc = localStorage.getItem('pc')
            let tabcontent = document.querySelectorAll(".tabcontent")
            let startpanel = document.querySelector("#startpanel")
            tabcontent.forEach(tab => tab.style.background = pc);
            startpanel.style.background = pc
            document.querySelector('#nav-theme > div > span > span').style.backgroundColor = pc
            localStorage.setItem('pc', color)
        }
        game.themeSetup.loadTabColor = function () {
            document.getElementById('navb-theme-e').value = localStorage.getItem('nvb') || '#191919'
            document.querySelector('#navb-theme > div > span > span').style.backgroundColor = document.getElementById('navb-theme-e').value
            let tabs = ["#home-menu", "#theme-menu", "#hotkeys-menu", "#settings-menu", "#changelog-menu", "#game > div.control-bar > div.buttons > div.button.dummy"]
            tabs.forEach(button => document.querySelector(button).style.background = document.getElementById('navb-theme-e').value);

        }
        game.themeSetup.changeTabColor = function (color) {
            let nvb = localStorage.getItem('nvb')
            let tabs = ["#home-menu", "#theme-menu", "#hotkeys-menu", "#settings-menu", "#changelog-menu", "#game > div.control-bar > div.buttons > div.button.dummy"]
            tabs.forEach(button => document.querySelector(button).style.background = nvb);
            document.querySelector('#navb-theme > div > span > span').style.backgroundColor = nvb
            localStorage.setItem('nvb', color)
        }
        game.themeSetup.loadTabIconColor = function () {
            document.getElementById('navi-theme-e').value = localStorage.getItem('nvi') || '#4c4c4c'
            document.querySelector('#navi-theme > div > span > span').style.backgroundColor = document.getElementById('navi-theme-e').value
            let tabIcons = ["#home-menu > div > div.icon", "#theme-menu > div > div.icon", "#hotkeys-menu > div > div.icon", "#settings-menu > div > div.icon", "#changelog-menu > div > div.icon"]
            tabIcons.forEach(icon => document.querySelector(icon).style.color = document.getElementById('navi-theme-e').value);

        }
        game.themeSetup.changeTabIconColor = function (color) {
            let nvi = localStorage.getItem('nvi')
            let tabIcons = ["#home-menu > div > div.icon", "#theme-menu > div > div.icon", "#hotkeys-menu > div > div.icon", "#settings-menu > div > div.icon", "#changelog-menu > div > div.icon"]
            tabIcons.forEach(icon => document.querySelector(icon).style.color = nvi);
            document.querySelector('#navi-theme > div > span > span').style.backgroundColor = nvi
            localStorage.setItem('nvi', color)
        }
        game.themeSetup.loadTabTextColor = function () {
            document.getElementById('nava-theme-e').value = localStorage.getItem('nva') || '#ffffff'
            document.querySelector('#nava-theme > div > span > span').style.backgroundColor = document.getElementById('nava-theme-e').value
            let tabText = ["#home-menu > div > div.label", "#theme-menu > div > div.label", "#hotkeys-menu > div > div.label", "#settings-menu > div > div.label", "#changelog-menu > div > div.label"]
            tabText.forEach(text => document.querySelector(text).style.color = document.getElementById('nava-theme-e').value);

        }
        game.themeSetup.changeTabTextColor = function (color) {
            let nva = localStorage.getItem('nva')
            let tabText = ["#home-menu > div > div.label", "#theme-menu > div > div.label", "#hotkeys-menu > div > div.label", "#settings-menu > div > div.label", "#changelog-menu > div > div.label"]
            tabText.forEach(text => document.querySelector(text).style.color = nva);
            document.querySelector('#nava-theme > div > span > span').style.backgroundColor = nva
            localStorage.setItem('nva', color)
        }
        game.themeSetup.loadInputColor = function () {
            document.getElementById('navin-theme-e').value = localStorage.getItem('nvin') || '#4c4c4c'
            document.querySelector('#navin-theme > div > span > span').style.backgroundColor = document.getElementById('navin-theme-e').value
            let inputs = document.querySelectorAll('.inputs')
            inputs.forEach(input => input.style.background = document.getElementById('navin-theme-e').value);


        }
        game.themeSetup.changeInputColor = function (color) {
            let nvin = localStorage.getItem('nvin')
            document.querySelector('#navin-theme > div > span > span').style.backgroundColor = nvin
            let inputs = document.querySelectorAll('.inputs')
            inputs.forEach(input => input.style.background = nvin);
            localStorage.setItem('nvin', color)
        }
        game.themeSetup.loadInputTextColor = function () {
            document.getElementById('navt-theme-e').value = localStorage.getItem('navt') || '#ffffff'
            document.querySelector('#navt-theme > div > span > span').style.backgroundColor = document.getElementById('navt-theme-e').value
            let inputText = [".cl-span", ".inputs", ".checkbox-span", ".theme-titles", ".hk-span", ".reset"]
            let inputs = document.querySelectorAll(inputText)
            inputs.forEach(input => input.style.color = document.getElementById('navt-theme-e').value);


        }
        game.themeSetup.changeInputTextColor = function (color) {
            let navt = localStorage.getItem('navt')
            document.querySelector('#navt-theme > div > span > span').style.backgroundColor = navt
            let inputText = [".cl-span", ".inputs", ".checkbox-span", ".theme-titles", ".hk-span", ".reset"]
            let inputs = document.querySelectorAll(inputText)
            inputs.forEach(input => input.style.color = navt);
            localStorage.setItem('navt', color)
        }
        game.themeSetup.loadButtonColor = function () {
            document.getElementById('navp-theme-e').value = localStorage.getItem('navp') || '#008CBA'
            document.querySelector('#navp-theme > div > span > span').style.backgroundColor = document.getElementById('navp-theme-e').value
            let playButton = document.getElementById('play-button')
            playButton.style.background = document.getElementById('navp-theme-e').value

        }
        game.themeSetup.changeButtonColor = function (color) {
            let navp = localStorage.getItem('navp')
            document.querySelector('#navp-theme > div > span > span').style.backgroundColor = navp
            let playButton = document.getElementById('play-button')
            playButton.style.background = navp
            localStorage.setItem('navp', color)
        }
        game.themeSetup.loadPreviewColor = function () {
            document.getElementById('navsp-theme-e').value = localStorage.getItem('navsp') || '#707070'
            document.querySelector('#navsp-theme > div > span > span').style.backgroundColor = document.getElementById('navsp-theme-e').value
            let preview = document.querySelectorAll(".skin-preview-circle")
            preview.forEach(fake => fake.style.border = `5px solid ${document.getElementById('navsp-theme-e').value}`);
        }
        game.themeSetup.changePreviewColor = function (color) {
            let navsp = localStorage.getItem('navsp')
            document.querySelector('#navsp-theme > div > span > span').style.backgroundColor = navsp
            let preview = document.querySelectorAll(".skin-preview-circle")
            preview.forEach(fake => fake.style.border = `5px solid ${navsp}`);
            localStorage.setItem('navsp', color)
        }
        game.themeSetup.loadInfoColor = function () {
            document.getElementById('gi-theme-e').value = localStorage.getItem('gi') || '#191919'
            document.querySelector('#gi-theme > div > span > span').style.backgroundColor = document.getElementById('gi-theme-e').value
            let fps = document.getElementById('fps')
            fps.style.background = document.getElementById('gi-theme-e').value
        }
        game.themeSetup.changeInfoColor = function (color) {
            let gi = localStorage.getItem('gi')
            document.querySelector('#gi-theme > div > span > span').style.backgroundColor = gi
            let fps = document.getElementById('fps')
            fps.style.background = gi
            localStorage.setItem('gi', color)
        }
        game.themeSetup.loadInfoTextColor = function () {
            document.getElementById('git-theme-e').value = localStorage.getItem('git') || '#ffffff'
            document.querySelector('#git-theme > div > span > span').style.backgroundColor = document.getElementById('git-theme-e').value
            let fps = document.getElementById('fps')
            fps.style.color = document.getElementById('git-theme-e').value
        }
        game.themeSetup.changeInfoTextColor = function (color) {
            let git = localStorage.getItem('git')
            document.querySelector('#git-theme > div > span > span').style.backgroundColor = git
            let fps = document.getElementById('fps')
            fps.style.color = git
            localStorage.setItem('git', color)
        }
        game.themeSetup.loadLeaderboardColor = function () {
            document.getElementById('lead-theme-e').value = localStorage.getItem('lead') || '#191919'
            document.querySelector('#lead-theme > div > span > span').style.backgroundColor = document.getElementById('lead-theme-e').value
            let leaderboard = document.querySelectorAll(".panel")
            leaderboard.forEach(board => board.style.background = document.getElementById('lead-theme-e').value)

        }
        game.themeSetup.changeLeaderboardColor = function (color) {
            let lead = localStorage.getItem('lead')
            document.querySelector('#lead-theme > div > span > span').style.backgroundColor = lead
            let leaderboard = document.querySelectorAll(".panel")
            leaderboard.forEach(board => board.style.background = lead)
            localStorage.setItem('lead', color)
        }
        game.themeSetup.loadLeaderboardTitleColor = function () {
            document.getElementById('leadt-theme-e').value = localStorage.getItem('leadt') || 'gray'
            document.querySelector('#leadt-theme > div > span > span').style.backgroundColor = document.getElementById('leadt-theme-e').value
            let leaderboardTitle = document.querySelector("#game > div.top > div.panel > center")
            leaderboardTitle.style.color = document.getElementById('leadt-theme-e').value
        }
        game.themeSetup.changeLeaderboardTitleColor = function (color) {
            let leadt = localStorage.getItem('leadt')
            document.querySelector('#leadt-theme > div > span > span').style.backgroundColor = leadt
            let leaderboardTitle = document.querySelector("#game > div.top > div.panel > center")
            leaderboardTitle.style.color = leadt
            localStorage.setItem('leadt', color)
        }
        game.themeSetup.loadLeaderboardNamesColor = function () {
            document.getElementById('leadn-theme-e').value = localStorage.getItem('leadn') || '#ffffff'
            document.querySelector('#leadn-theme > div > span > span').style.backgroundColor = document.getElementById('leadn-theme-e').value
            setInterval(() => {
                if (document.getElementsByClassName('topname').length) {
                    let leaderboardNames = document.querySelectorAll(".topname")
                    leaderboardNames.forEach(name => name.style.color = document.getElementById('leadn-theme-e').value)
                }
            }, 100);
        }
        game.themeSetup.changeLeaderboardNamesColor = function (color) {
            let leadn = localStorage.getItem('leadn')
            document.querySelector('#leadn-theme > div > span > span').style.backgroundColor = leadn
            let leaderboardNames = document.querySelectorAll(".topname")
            leaderboardNames.forEach(name => name.style.color = leadn)
            localStorage.setItem('leadn', color)
        }
        game.themeSetup.loadLeaderboardMassColor = function () {
            document.getElementById('leadm-theme-e').value = localStorage.getItem('leadm') || '#191919'
            document.querySelector('#leadm-theme > div > span > span').style.backgroundColor = document.getElementById('leadm-theme-e').value
            let leaderboardMass = document.querySelectorAll(".topmass")
            leaderboardMass.forEach(mass => mass.style.color = document.getElementById('leadm-theme-e').value)
        }
        game.themeSetup.changeLeaderboardMassColor = function (color) {
            let leadm = localStorage.getItem('leadm')
            document.querySelector('#leadm-theme > div > span > span').style.backgroundColor = leadm
            let leaderboardMass = document.querySelectorAll(".topmass")
            leaderboardMass.forEach(mass => mass.style.color = leadm)
            localStorage.setItem('leadm', color)
        }
        game.themeSetup.loadMapColor = function () {
            document.getElementById('map-theme-e').value = localStorage.getItem('map') || 'black'
            document.querySelector('#map-theme > div > span > span').style.backgroundColor = document.getElementById('map-theme-e').value
        }
        game.themeSetup.changeMapColor = function (color) {
            let minimap = localStorage.getItem('map')
            document.querySelector('#map-theme > div > span > span').style.backgroundColor = minimap
            localStorage.setItem('map', color)
        }
        game.themeSetup.loadMapContainerColor = function () {
            document.getElementById('mapb-theme-e').value = localStorage.getItem('mapb') || '#191919'
            document.querySelector('#mapb-theme > div > span > span').style.backgroundColor = document.getElementById('mapb-theme-e').value
            let mapContainer = document.getElementById('minimap-container')
            mapContainer.style.background = document.getElementById('mapb-theme-e').value
        }
        game.themeSetup.changeMapContainerColor = function (color) {
            let mapb = localStorage.getItem('mapb')
            document.querySelector('#mapb-theme > div > span > span').style.backgroundColor = mapb
            let mapContainer = document.getElementById('minimap-container')
            mapContainer.style.background = mapb
            localStorage.setItem('mapb', color)
        }
        game.themeSetup.loadMapNamesColor = function () {
            document.getElementById('mapn-theme-e').value = localStorage.getItem('mapn') || '#ffffff'
            document.querySelector('#mapn-theme > div > span > span').style.backgroundColor = document.getElementById('mapn-theme-e').value
        }
        game.themeSetup.changeMapNamesColor = function (color) {
            let mapn = localStorage.getItem('mapn')
            document.querySelector('#mapn-theme > div > span > span').style.backgroundColor = mapn
            localStorage.setItem('mapn', color)
        }
        game.themeSetup.loadMapDotColor = function () {
            document.getElementById('mapd-theme-e').value = localStorage.getItem('mapd') || 'gray'
            document.querySelector('#mapd-theme > div > span > span').style.backgroundColor = document.getElementById('mapd-theme-e').value
        }
        game.themeSetup.changeMapDotColor = function (color) {
            let mapd = localStorage.getItem('mapd')
            document.querySelector('#mapd-theme > div > span > span').style.backgroundColor = mapd
            localStorage.setItem('mapd', color)
        }
        game.themeSetup.loadMapLineColor = function () {
            document.getElementById('mapl-theme-e').value = localStorage.getItem('mapl') || 'gray'
            document.querySelector('#mapl-theme > div > span > span').style.backgroundColor = document.getElementById('mapl-theme-e').value
            document.getElementById('biomium-minimap').style.border = `1px solid ${document.getElementById('mapl-theme-e').value}`
        }
        game.themeSetup.changeMapLineColor = function (color) {
            let mapl = localStorage.getItem('mapl')
            document.querySelector('#mapl-theme > div > span > span').style.backgroundColor = mapl
            document.getElementById('biomium-minimap').style.border = `1px solid ${mapl}`
            localStorage.setItem('mapl', color)
        }
        game.themeSetup.loadMapSectorColor = function () {
            document.getElementById('maps-theme-e').value = localStorage.getItem('maps') || 'gray'
            document.querySelector('#maps-theme > div > span > span').style.backgroundColor = document.getElementById('maps-theme-e').value
            document.querySelector("#sector-location").style.color = document.getElementById('maps-theme-e').value
        }
        game.themeSetup.changeMapSectorColor = function (color) {
            let maps = localStorage.getItem('maps')
            document.querySelector('#maps-theme > div > span > span').style.backgroundColor = maps
            document.querySelector("#sector-location").style.color = maps
            localStorage.setItem('maps', color)
        }
        game.themeSetup.loadFloorColor = function () {
            setInterval(() => {
                if (game.world && game.world.floor.material.color) {
                    document.getElementById('flo-theme-e').value = localStorage.getItem('flo') || '#211e1e'
                    game.world.floor.material.color = new THREE.Color(document.getElementById('flo-theme-e').value);

                }
                document.querySelector('#flo-theme > div > span > span').style.backgroundColor = document.getElementById('flo-theme-e').value
            }, 100);
        }
        game.themeSetup.changeFloorColor = function (color) {
            let flo = localStorage.getItem('flo')
            game.world.floor.material.color = new THREE.Color(flo)
            document.querySelector('#flo-theme > div > span > span').style.backgroundColor = flo
            localStorage.setItem('flo', color)
        }
        game.themeSetup.loadFogColor = function () {
            setInterval(() => {
                if (game.world && game.world.scene.fog.color) {
                    document.getElementById('fog-theme-e').value = localStorage.getItem('fog') || '#ffffff'
                    game.world.scene.fog.color = new THREE.Color(document.getElementById('fog-theme-e').value);
                }
                document.querySelector('#fog-theme > div > span > span').style.backgroundColor = document.getElementById('fog-theme-e').value
            }, 100);
        }
        game.themeSetup.changeFogColor = function (color) {
            let fog = localStorage.getItem('fog')
            game.world.scene.fog.color = new THREE.Color(fog)
            document.querySelector('#fog-theme > div > span > span').style.backgroundColor = fog
            localStorage.setItem('fog', color)
        }
        game.themeSetup.loadFoodColor = function () {
            document.getElementById('food-theme-e').value = localStorage.getItem('food') || '#ffffff'
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "IcosahedronGeometry") {
                    game.world.scene.children[i].material.color = new THREE.Color(document.getElementById('food-theme-e').value)
                }
            }
            document.querySelector('#food-theme > div > span > span').style.backgroundColor = document.getElementById('food-theme-e').value
        }
        game.themeSetup.changeFoodColor = function (color) {
            let food = localStorage.getItem('food')
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "IcosahedronGeometry") {
                    game.world.scene.children[i].material.color = new THREE.Color(food);
                }
            }
            document.querySelector('#food-theme > div > span > span').style.backgroundColor = food
            localStorage.setItem('food', color)
        }
        game.themeSetup.loadWallColor = function () {
            document.getElementById('wall-theme-e').value = localStorage.getItem('wall') || '#000000'
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MultiMaterial") {
                    for (j = 0; j < game.world.scene.children[i].material.materials.length; j++) {
                        game.world.scene.children[i].material.materials[j].color = new THREE.Color(document.getElementById('wall-theme-e').value)
                    }
                }
            }
            document.querySelector('#wall-theme > div > span > span').style.backgroundColor = document.getElementById('wall-theme-e').value
        }
        game.themeSetup.changeWallColor = function (color) {
            let wall = localStorage.getItem('wall')
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MultiMaterial") {
                    for (j = 0; j < game.world.scene.children[i].material.materials.length; j++) {
                        game.world.scene.children[i].material.materials[j].color = new THREE.Color(wall)
                    }
                }
            }
            document.querySelector('#wall-theme > div > span > span').style.backgroundColor = wall
            localStorage.setItem('wall', color)
        }
        game.themeSetup.loadTreeLeaves = function () {
            document.getElementById('tree-theme-e').value = localStorage.getItem('tle') || '#4c4c4c'
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].name == "TreeTrunks" || game.world.scene.children[i].material && game.world.scene.children[i].geometry && game.world.scene.children[i].material.type && game.world.scene.children[i].geometry.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "Geometry") {
                    if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].geometry.boundingSphere.radius == 3410.7008451964452) {
                        game.world.scene.children[i].material.emissive.set(document.getElementById('tree-theme-e').value);
                    }
                }
            }
            document.querySelector('#tree-theme > div > span > span').style.backgroundColor = document.getElementById('tree-theme-e').value
        }
        game.themeSetup.changeTreeLeaves = function (color) {
            let tle = localStorage.getItem('tle')
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].name == "TreeTrunks" || game.world.scene.children[i].material && game.world.scene.children[i].geometry && game.world.scene.children[i].material.type && game.world.scene.children[i].geometry.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "Geometry") {
                    if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].geometry.boundingSphere.radius == 3410.7008451964452) {
                        game.world.scene.children[i].material.emissive.set(tle)
                    }
                }
            }
            document.querySelector('#tree-theme > div > span > span').style.backgroundColor = tle
            localStorage.setItem('tle', color)
        }
        game.themeSetup.loadTreeTrunk = function () {
            document.getElementById('trunk-theme-e').value = localStorage.getItem('ttr') || '#000000'
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].name == "TreeTrunks" || game.world.scene.children[i].material && game.world.scene.children[i].geometry && game.world.scene.children[i].material.type && game.world.scene.children[i].geometry.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "Geometry") {
                    if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].geometry.boundingSphere.radius == 3410.7008451964452) {

                    } else {
                        game.world.scene.children[i].name = "TreeTrunks"

                        game.world.scene.children[i].material.emissive.set(document.getElementById('trunk-theme-e').value);
                    }
                }
            }
            document.querySelector('#trunk-theme > div > span > span').style.backgroundColor = document.getElementById('trunk-theme-e').value
        }
        game.themeSetup.changeTreeTrunk = function (color) {
            let ttr = localStorage.getItem('ttr')
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].name == "TreeTrunks" || game.world.scene.children[i].material && game.world.scene.children[i].geometry && game.world.scene.children[i].material.type && game.world.scene.children[i].geometry.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "Geometry") {
                    if (game.world.scene.children[i].name == "TreeTops" || game.world.scene.children[i].geometry.boundingSphere.radius == 3410.7008451964452) {

                    } else {
                        game.world.scene.children[i].name = "TreeTrunks"

                        game.world.scene.children[i].material.emissive.set(ttr);
                    }
                }
            }
            document.querySelector('#trunk-theme > div > span > span').style.backgroundColor = ttr
            localStorage.setItem('ttr', color)
        }
        game.themeSetup.loadTeamTitleColor = function () {
            document.getElementById('teamt-theme-e').value = localStorage.getItem('teamt') || '#ffffff'
            document.querySelector('#teamt-theme > div > span > span').style.backgroundColor = document.getElementById('teamt-theme-e').value
            let teamTitle = document.getElementById('teammates-title')
            teamTitle.style.color = document.getElementById('teamt-theme-e').value
        }
        game.themeSetup.changeTeamTitleColor = function (color) {
            let teamt = localStorage.getItem('teamt')
            document.querySelector('#teamt-theme > div > span > span').style.backgroundColor = teamt
            let teamTitle = document.getElementById('teammates-title')
            teamTitle.style.color = teamt
            localStorage.setItem('teamt', color)
        }
        game.themeSetup.loadTeamTextColor = function () {
            document.getElementById('teamtxt-theme-e').value = localStorage.getItem('teamtxt') || '#ffffff'
            document.querySelector('#teamtxt-theme > div > span > span').style.backgroundColor = document.getElementById('teamtxt-theme-e').value
            let teammatesData = document.getElementById('teammates-top5')
            teammatesData.style.color = document.getElementById('teamtxt-theme-e').value
        }
        game.themeSetup.changeTeamTextColor = function (color) {
            let teamtxt = localStorage.getItem('teamtxt')
            document.querySelector('#teamtxt-theme > div > span > span').style.backgroundColor = teamtxt
            let teammatesData = document.getElementById('teammates-top5')
            teammatesData.style.color = teamtxt
            localStorage.setItem('teamtxt', color)
        }
        game.themeSetup.loadTeamBackgroundColor = function () {
            document.getElementById('teamb-theme-e').value = localStorage.getItem('teamb') || '#191919'
            document.querySelector('#teamb-theme > div > span > span').style.backgroundColor = document.getElementById('teamb-theme-e').value
            let teammatesDatab = document.getElementById('teammates')
            teammatesDatab.style.background = document.getElementById('teamb-theme-e').value
        }
        game.themeSetup.changeTeamBackgroundColor = function (color) {
            let teamb = localStorage.getItem('teamb')
            document.querySelector('#teamb-theme > div > span > span').style.backgroundColor = teamb
            let teammatesDatab = document.getElementById('teammates')
            teammatesDatab.style.background = teamb
            localStorage.setItem('teamb', color)
        }
        game.themeSetup.loadTimeBackgroundColor = function () {
            document.getElementById('teamo-theme-e').value = localStorage.getItem('teamo') || '#191919'
            document.querySelector('#teamo-theme > div > span > span').style.backgroundColor = document.getElementById('teamo-theme-e').value
            let timebackground = document.getElementById('currentTime')
            timebackground.style.background = document.getElementById('teamo-theme-e').value
        }
        game.themeSetup.changeTimeBackgroundColor = function (color) {
            let teamo = localStorage.getItem('teamo')
            document.querySelector('#teamo-theme > div > span > span').style.backgroundColor = teamo
            let timebackground = document.getElementById('currentTime')
            timebackground.style.background = teamo
            localStorage.setItem('teamo', color)
        }
        game.themeSetup.loadTimeColor = function () {
            document.getElementById('timeb-theme-e').value = localStorage.getItem('timeb') || 'gray'
            document.querySelector('#timeb-theme > div > span > span').style.backgroundColor = document.getElementById('timeb-theme-e').value
            let timecolor = document.getElementById('currentTime')
            timecolor.style.color = document.getElementById('timeb-theme-e').value
        }
        game.themeSetup.changeTimeColor = function (color) {
            let timeb = localStorage.getItem('timeb')
            document.querySelector('#timeb-theme > div > span > span').style.backgroundColor = timeb
            let timecolor = document.getElementById('currentTime')
            timecolor.style.color = timeb
            localStorage.setItem('timeb', color)
        }


        $('.demo').minicolors({
            change: function (value) {
                document.getElementById('premade-themes').value = "Custom/Default"
                localStorage.setItem('pickerVal', document.getElementById('premade-themes').value)
                if (this.id === 'nav-theme-e') { game.themeSetup.changeNavColor(value) }
                if (this.id === 'navb-theme-e') { game.themeSetup.changeTabColor(value) }
                if (this.id === 'navi-theme-e') { game.themeSetup.changeTabIconColor(value) }
                if (this.id === 'nava-theme-e') { game.themeSetup.changeTabTextColor(value) }
                if (this.id === 'navin-theme-e') { game.themeSetup.changeInputColor(value) }
                if (this.id === 'navt-theme-e') { game.themeSetup.changeInputTextColor(value) }
                if (this.id === 'navp-theme-e') { game.themeSetup.changeButtonColor(value) }
                if (this.id === 'navsp-theme-e') { game.themeSetup.changePreviewColor(value) }
                if (this.id === 'gi-theme-e') { game.themeSetup.changeInfoColor(value) }
                if (this.id === 'git-theme-e') { game.themeSetup.changeInfoTextColor(value) }
                if (this.id === 'lead-theme-e') { game.themeSetup.changeLeaderboardColor(value) }
                if (this.id === 'leadt-theme-e') { game.themeSetup.changeLeaderboardTitleColor(value) }
                if (this.id === 'leadn-theme-e') { game.themeSetup.changeLeaderboardNamesColor(value) }
                if (this.id === 'leadm-theme-e') { game.themeSetup.changeLeaderboardMassColor(value) }
                if (this.id === 'map-theme-e') { game.themeSetup.changeMapColor(value) }
                if (this.id === 'mapb-theme-e') { game.themeSetup.changeMapContainerColor(value) }
                if (this.id === 'mapn-theme-e') { game.themeSetup.changeMapNamesColor(value) }
                if (this.id === 'mapd-theme-e') { game.themeSetup.changeMapDotColor(value) }
                if (this.id === 'mapl-theme-e') { game.themeSetup.changeMapLineColor(value) }
                if (this.id === 'maps-theme-e') { game.themeSetup.changeMapSectorColor(value) }
                if (this.id === 'flo-theme-e') { game.themeSetup.changeFloorColor(value) }
                if (this.id === 'fog-theme-e') { game.themeSetup.changeFogColor(value) }
                if (this.id === 'food-theme-e') { game.themeSetup.changeFoodColor(value) }
                if (this.id === 'wall-theme-e') { game.themeSetup.changeWallColor(value) }
                if (this.id === 'tree-theme-e') { game.themeSetup.changeTreeLeaves(value) }
                if (this.id === 'trunk-theme-e') { game.themeSetup.changeTreeTrunk(value) }
                if (this.id === 'teamt-theme-e') { game.themeSetup.changeTeamTitleColor(value) }
                if (this.id === 'teamtxt-theme-e') { game.themeSetup.changeTeamTextColor(value) }
                if (this.id === 'teamb-theme-e') { game.themeSetup.changeTeamBackgroundColor(value) }
                if (this.id === 'teamo-theme-e') { game.themeSetup.changeTimeBackgroundColor(value) }
                if (this.id === 'timeb-theme-e') { game.themeSetup.changeTimeColor(value) }
            }
        });
        game.themeSetup.loadNavColor()
        game.themeSetup.loadTabColor()
        game.themeSetup.loadTabIconColor()
        game.themeSetup.loadTabTextColor()
        game.themeSetup.loadInputColor()
        game.themeSetup.loadInputTextColor()
        game.themeSetup.loadButtonColor()
        game.themeSetup.loadPreviewColor()
        game.themeSetup.loadInfoColor()
        game.themeSetup.loadInfoTextColor()
        game.themeSetup.loadLeaderboardColor()
        game.themeSetup.loadLeaderboardTitleColor()
        game.themeSetup.loadLeaderboardNamesColor()
        game.themeSetup.loadLeaderboardMassColor()
        game.themeSetup.loadMapColor()
        game.themeSetup.loadMapContainerColor()
        game.themeSetup.loadMapNamesColor()
        game.themeSetup.loadMapDotColor()
        game.themeSetup.loadMapLineColor()
        game.themeSetup.loadMapSectorColor()
        game.themeSetup.loadFloorColor()
        game.themeSetup.loadFogColor()
        game.themeSetup.loadFoodColor()
        game.themeSetup.loadWallColor()
        game.themeSetup.loadTreeLeaves()
        game.themeSetup.loadTreeTrunk()
        game.themeSetup.loadTeamTitleColor()
        game.themeSetup.loadTeamTextColor()
        game.themeSetup.loadTeamBackgroundColor()
        game.themeSetup.loadTimeBackgroundColor()
        game.themeSetup.loadTimeColor()

        let themsBtn = document.getElementById('premade-themes')
        themsBtn.value = localStorage.getItem('pickerVal') || 'Custom/Default'
        themsBtn.onchange = function () {
            localStorage.setItem('pickerVal', this.value)
            if (this.value === "Light") {
                document.getElementById('pi-theme').value = ""
                game.themeSetup.changeNavColor("#c9c3c3"); game.themeSetup.loadNavColor()
                game.themeSetup.changeTabColor("#ffffff"); game.themeSetup.loadTabColor()
                game.themeSetup.changeTabIconColor("#cfcfcf"); game.themeSetup.loadTabIconColor()
                game.themeSetup.changeTabTextColor("#8c8989"); game.themeSetup.loadTabTextColor()
                game.themeSetup.changeInputColor("#999191"); game.themeSetup.loadInputColor()
                game.themeSetup.changeInputTextColor("#fffcfc"); game.themeSetup.loadInputTextColor()
                game.themeSetup.changeButtonColor("#aba4a4"); game.themeSetup.loadButtonColor()
                game.themeSetup.changePreviewColor("#d6d2d2"); game.themeSetup.loadPreviewColor()
                game.themeSetup.changeInfoColor("#ffffff"); game.themeSetup.loadInfoColor()
                game.themeSetup.changeInfoTextColor("#878282"); game.themeSetup.loadInfoTextColor()
                game.themeSetup.changeLeaderboardColor("#ffffff"); game.themeSetup.loadLeaderboardColor()
                game.themeSetup.changeLeaderboardTitleColor("#857c7c"); game.themeSetup.loadLeaderboardTitleColor()
                game.themeSetup.changeLeaderboardNamesColor("#6e5e5e"); game.themeSetup.loadLeaderboardNamesColor()
                game.themeSetup.changeLeaderboardMassColor("#706767"); game.themeSetup.loadLeaderboardMassColor()
                game.themeSetup.changeMapColor("#ffffff"); game.themeSetup.loadMapColor()
                game.themeSetup.changeMapContainerColor("#d6d6d6"); game.themeSetup.loadMapContainerColor()
                game.themeSetup.changeMapNamesColor("#524f4f"); game.themeSetup.loadMapNamesColor()
                game.themeSetup.changeMapDotColor("#423d3d"); game.themeSetup.loadMapDotColor()
                game.themeSetup.changeMapLineColor("#1a1a1a"); game.themeSetup.loadMapLineColor()
                game.themeSetup.changeMapSectorColor("gray"); game.themeSetup.loadMapSectorColor()
                game.themeSetup.changeFloorColor("#ffffff"); game.themeSetup.loadFloorColor()
                game.themeSetup.changeFogColor("#aba8a8"); game.themeSetup.loadFogColor()
                game.themeSetup.changeFoodColor("#c4c0c0"); game.themeSetup.loadFoodColor()
                game.themeSetup.changeWallColor("#ffffff"); game.themeSetup.loadWallColor()
                game.themeSetup.changeTreeLeaves("#f7f7f7"); game.themeSetup.loadTreeLeaves()
                game.themeSetup.changeTreeTrunk("#c4c4c4"); game.themeSetup.loadTreeTrunk()
                game.themeSetup.changeTeamTitleColor("#827878"); game.themeSetup.loadTeamTitleColor()
                game.themeSetup.changeTeamTextColor("#878282"); game.themeSetup.loadTeamTextColor()
                game.themeSetup.changeTeamBackgroundColor("#ffffff"); game.themeSetup.loadTeamBackgroundColor()
                game.themeSetup.changeTimeBackgroundColor("#ffffff"); game.themeSetup.loadTimeBackgroundColor()
                game.themeSetup.changeTimeColor("#878282"); game.themeSetup.loadTimeColor()
            }
            if (this.value === "Dark") {
                document.getElementById('pi-theme').value = ""
                game.themeSetup.changeNavColor("#000000"); game.themeSetup.loadNavColor()
                game.themeSetup.changeTabColor("#000000"); game.themeSetup.loadTabColor()
                game.themeSetup.changeTabIconColor("#4d4d4d"); game.themeSetup.loadTabIconColor()
                game.themeSetup.changeTabTextColor("#4d4d4d"); game.themeSetup.loadTabTextColor()
                game.themeSetup.changeInputColor("#1c1c1c"); game.themeSetup.loadInputColor()
                game.themeSetup.changeInputTextColor("#302f2f"); game.themeSetup.loadInputTextColor()
                game.themeSetup.changeButtonColor("#000000"); game.themeSetup.loadButtonColor()
                game.themeSetup.changePreviewColor("#4d4b4b"); game.themeSetup.loadPreviewColor()
                game.themeSetup.changeInfoColor("#000000"); game.themeSetup.loadInfoColor()
                game.themeSetup.changeInfoTextColor("#302f2f"); game.themeSetup.loadInfoTextColor()
                game.themeSetup.changeLeaderboardColor("#000000"); game.themeSetup.loadLeaderboardColor()
                game.themeSetup.changeLeaderboardTitleColor("#302f2f"); game.themeSetup.loadLeaderboardTitleColor()
                game.themeSetup.changeLeaderboardNamesColor("#6e5e5e"); game.themeSetup.loadLeaderboardNamesColor()
                game.themeSetup.changeLeaderboardMassColor("#706767"); game.themeSetup.loadLeaderboardMassColor()
                game.themeSetup.changeMapColor("#000000"); game.themeSetup.loadMapColor()
                game.themeSetup.changeMapContainerColor("#000000"); game.themeSetup.loadMapContainerColor()
                game.themeSetup.changeMapNamesColor("#ffffff"); game.themeSetup.loadMapNamesColor()
                game.themeSetup.changeMapDotColor("#302f2f"); game.themeSetup.loadMapDotColor()
                game.themeSetup.changeMapLineColor("gray"); game.themeSetup.loadMapLineColor()
                game.themeSetup.changeMapSectorColor("gray"); game.themeSetup.loadMapSectorColor()
                game.themeSetup.changeFloorColor("#0a0a0a"); game.themeSetup.loadFloorColor()
                game.themeSetup.changeFogColor("#0f0f0f"); game.themeSetup.loadFogColor()
                game.themeSetup.changeFoodColor("#5c5c5c"); game.themeSetup.loadFoodColor()
                game.themeSetup.changeWallColor("#000000"); game.themeSetup.loadWallColor()
                game.themeSetup.changeTreeLeaves("#f7f7f7"); game.themeSetup.loadTreeLeaves()
                game.themeSetup.changeTreeTrunk("#000000"); game.themeSetup.loadTreeTrunk()
                game.themeSetup.changeTeamTitleColor("#302f2f"); game.themeSetup.loadTeamTitleColor()
                game.themeSetup.changeTeamTextColor("#6e5e5e"); game.themeSetup.loadTeamTextColor()
                game.themeSetup.changeTeamBackgroundColor("#000000"); game.themeSetup.loadTeamBackgroundColor()
                game.themeSetup.changeTimeBackgroundColor("#000000"); game.themeSetup.loadTimeBackgroundColor()
                game.themeSetup.changeTimeColor("#6e5e5e"); game.themeSetup.loadTimeColor()
            }
            if (this.value === "High Fuel") {
                document.getElementById('pi-theme').value = "https://i.imgur.com/qU7LhGt.jpg"
                game.themeSetup.changeNavColor("#012e0a"); game.themeSetup.loadNavColor()
                game.themeSetup.changeTabColor("#54b359"); game.themeSetup.loadTabColor()
                game.themeSetup.changeTabIconColor("#78d45b"); game.themeSetup.loadTabIconColor()
                game.themeSetup.changeTabTextColor("#8af23a"); game.themeSetup.loadTabTextColor()
                game.themeSetup.changeInputColor("#2e2a2a"); game.themeSetup.loadInputColor()
                game.themeSetup.changeInputTextColor("#8af23a"); game.themeSetup.loadInputTextColor()
                game.themeSetup.changeButtonColor("#2b703c"); game.themeSetup.loadButtonColor()
                game.themeSetup.changePreviewColor("#a4f5bb"); game.themeSetup.loadPreviewColor()
                game.themeSetup.changeInfoColor("#1da326"); game.themeSetup.loadInfoColor()
                game.themeSetup.changeInfoTextColor("#84ff00"); game.themeSetup.loadInfoTextColor()
                game.themeSetup.changeLeaderboardColor("#51c74d"); game.themeSetup.loadLeaderboardColor()
                game.themeSetup.changeLeaderboardTitleColor("#00ff95"); game.themeSetup.loadLeaderboardTitleColor()
                game.themeSetup.changeLeaderboardNamesColor("#1c5212"); game.themeSetup.loadLeaderboardNamesColor()
                game.themeSetup.changeLeaderboardMassColor("#4d8525"); game.themeSetup.loadLeaderboardMassColor()
                game.themeSetup.changeMapColor("#1b4f14"); game.themeSetup.loadMapColor()
                game.themeSetup.changeMapContainerColor("#00ff73"); game.themeSetup.loadMapContainerColor()
                game.themeSetup.changeMapNamesColor("#dde812"); game.themeSetup.loadMapNamesColor()
                game.themeSetup.changeMapDotColor("#1f1f1f"); game.themeSetup.loadMapDotColor()
                game.themeSetup.changeMapLineColor("#66ff00"); game.themeSetup.loadMapLineColor()
                game.themeSetup.changeMapSectorColor("#3e660d"); game.themeSetup.loadMapSectorColor()
                game.themeSetup.changeFloorColor("#3eb000"); game.themeSetup.loadFloorColor()
                game.themeSetup.changeFogColor("#1cc725"); game.themeSetup.loadFogColor()
                game.themeSetup.changeFoodColor("#00ff88"); game.themeSetup.loadFoodColor()
                game.themeSetup.changeWallColor("#000000"); game.themeSetup.loadWallColor()
                game.themeSetup.changeTreeLeaves("#24ff24"); game.themeSetup.loadTreeLeaves()
                game.themeSetup.changeTreeTrunk("#19cc37"); game.themeSetup.loadTreeTrunk()
                game.themeSetup.changeTeamTitleColor("#00ff91"); game.themeSetup.loadTeamTitleColor()
                game.themeSetup.changeTeamTextColor("#c8d911"); game.themeSetup.loadTeamTextColor()
                game.themeSetup.changeTeamBackgroundColor("#03995d"); game.themeSetup.loadTeamBackgroundColor()
                game.themeSetup.changeTimeBackgroundColor("#157334"); game.themeSetup.loadTimeBackgroundColor()
                game.themeSetup.changeTimeColor("#71db21"); game.themeSetup.loadTimeColor()
            }
            if (this.value === "Ogar") {
                document.getElementById('pi-theme').value = "https://i.imgur.com/6EXvTei.png"
                game.themeSetup.changeNavColor("#191919"); game.themeSetup.loadNavColor()
                game.themeSetup.changeTabColor("#002f52"); game.themeSetup.loadTabColor()
                game.themeSetup.changeTabIconColor("#00d6cb"); game.themeSetup.loadTabIconColor()
                game.themeSetup.changeTabTextColor("#5000ff"); game.themeSetup.loadTabTextColor()
                game.themeSetup.changeInputColor("#002f52"); game.themeSetup.loadInputColor()
                game.themeSetup.changeInputTextColor("#ffffff"); game.themeSetup.loadInputTextColor()
                game.themeSetup.changeButtonColor("#8d5fe6"); game.themeSetup.loadButtonColor()
                game.themeSetup.changePreviewColor("#002f52"); game.themeSetup.loadPreviewColor()
                game.themeSetup.changeInfoColor("#000000"); game.themeSetup.loadInfoColor()
                game.themeSetup.changeInfoTextColor("#ffffff"); game.themeSetup.loadInfoTextColor()
                game.themeSetup.changeLeaderboardColor("#000000"); game.themeSetup.loadLeaderboardColor()
                game.themeSetup.changeLeaderboardTitleColor("#00d6cb"); game.themeSetup.loadLeaderboardTitleColor()
                game.themeSetup.changeLeaderboardNamesColor("#ffffff"); game.themeSetup.loadLeaderboardNamesColor()
                game.themeSetup.changeLeaderboardMassColor("#bd00a7"); game.themeSetup.loadLeaderboardMassColor()
                game.themeSetup.changeMapColor("#000000"); game.themeSetup.loadMapColor()
                game.themeSetup.changeMapContainerColor("#000000"); game.themeSetup.loadMapContainerColor()
                game.themeSetup.changeMapNamesColor("#ffffff"); game.themeSetup.loadMapNamesColor()
                game.themeSetup.changeMapDotColor("#808080"); game.themeSetup.loadMapDotColor()
                game.themeSetup.changeMapLineColor("#808080"); game.themeSetup.loadMapLineColor()
                game.themeSetup.changeMapSectorColor("#808080"); game.themeSetup.loadMapSectorColor()
                game.themeSetup.changeFloorColor("#002f52"); game.themeSetup.loadFloorColor()
                game.themeSetup.changeFogColor("#00d1c7"); game.themeSetup.loadFogColor()
                game.themeSetup.changeFoodColor("#5000ff"); game.themeSetup.loadFoodColor()
                game.themeSetup.changeWallColor("#000000"); game.themeSetup.loadWallColor()
                game.themeSetup.changeTreeLeaves("#1cffb0"); game.themeSetup.loadTreeLeaves()
                game.themeSetup.changeTreeTrunk("#19a669"); game.themeSetup.loadTreeTrunk()
                game.themeSetup.changeTeamTitleColor("#00d1c7"); game.themeSetup.loadTeamTitleColor()
                game.themeSetup.changeTeamTextColor("#ffffff"); game.themeSetup.loadTeamTextColor()
                game.themeSetup.changeTeamBackgroundColor("#000000"); game.themeSetup.loadTeamBackgroundColor()
                game.themeSetup.changeTimeBackgroundColor("#000000"); game.themeSetup.loadTimeBackgroundColor()
                game.themeSetup.changeTimeColor("#00d1c7"); game.themeSetup.loadTimeColor()
            }

        }

        let resetThemesBtn = document.getElementById('reset-theme-btn')
        resetThemesBtn.onclick = function () {
            document.getElementById('premade-themes').value = "Custom/Default"
            localStorage.setItem('pickerVal', document.getElementById('premade-themes').value)
            document.getElementById('pi-theme').value = ""
            game.themeSetup.changeNavColor("#191919"); game.themeSetup.loadNavColor()
            game.themeSetup.changeTabColor("#191919"); game.themeSetup.loadTabColor()
            game.themeSetup.changeTabIconColor("#4c4c4c"); game.themeSetup.loadTabIconColor()
            game.themeSetup.changeTabTextColor("#ffffff"); game.themeSetup.loadTabTextColor()
            game.themeSetup.changeInputColor("#4c4c4c"); game.themeSetup.loadInputColor()
            game.themeSetup.changeInputTextColor("#ffffff"); game.themeSetup.loadInputTextColor()
            game.themeSetup.changeButtonColor("#008CBA"); game.themeSetup.loadButtonColor()
            game.themeSetup.changePreviewColor("#707070"); game.themeSetup.loadPreviewColor()
            game.themeSetup.changeInfoColor("#191919"); game.themeSetup.loadInfoColor()
            game.themeSetup.changeInfoTextColor("#ffffff"); game.themeSetup.loadInfoTextColor()
            game.themeSetup.changeLeaderboardColor("#191919"); game.themeSetup.loadLeaderboardColor()
            game.themeSetup.changeLeaderboardTitleColor("#808080"); game.themeSetup.loadLeaderboardTitleColor()
            game.themeSetup.changeLeaderboardNamesColor("#ffffff"); game.themeSetup.loadLeaderboardNamesColor()
            game.themeSetup.changeLeaderboardMassColor("#a8a8a8"); game.themeSetup.loadLeaderboardMassColor()
            game.themeSetup.changeMapColor("#000000"); game.themeSetup.loadMapColor()
            game.themeSetup.changeMapContainerColor("#191919"); game.themeSetup.loadMapContainerColor()
            game.themeSetup.changeMapNamesColor("#ffffff"); game.themeSetup.loadMapNamesColor()
            game.themeSetup.changeMapDotColor("#808080"); game.themeSetup.loadMapDotColor()
            game.themeSetup.changeMapLineColor("#808080"); game.themeSetup.loadMapLineColor()
            game.themeSetup.changeMapSectorColor("#808080"); game.themeSetup.loadMapSectorColor()
            game.themeSetup.changeFloorColor("#211e1e"); game.themeSetup.loadFloorColor()
            game.themeSetup.changeFogColor("#ffffff"); game.themeSetup.loadFogColor()
            game.themeSetup.changeFoodColor("#ffffff"); game.themeSetup.loadFoodColor()
            game.themeSetup.changeWallColor("#000000"); game.themeSetup.loadWallColor()
            game.themeSetup.changeTreeLeaves("#4c4c4c"); game.themeSetup.loadTreeLeaves()
            game.themeSetup.changeTreeTrunk("#000000"); game.themeSetup.loadTreeTrunk()
            game.themeSetup.changeTeamTitleColor("#808080"); game.themeSetup.loadTeamTitleColor()
            game.themeSetup.changeTeamTextColor("#ffffff"); game.themeSetup.loadTeamTextColor()
            game.themeSetup.changeTeamBackgroundColor("#191919"); game.themeSetup.loadTeamBackgroundColor()
            game.themeSetup.changeTimeBackgroundColor("#191919"); game.themeSetup.loadTimeBackgroundColor()
            game.themeSetup.changeTimeColor("#808080"); game.themeSetup.loadTimeColor()
        }

        document.getElementById('reset-settings-btn').onclick = function () {

            if (!giswitch_e.checked) giswitch_e.click();
            if (miswitch_e.checked) giswitch_e.click();
            if (!hlswitch_e.checked) hlswitch_e.click();
            if (!teammatesswitch_e.checked) teammatesswitch_e.click()
            if (!smswitch_e.checked) smswitch_e.click()
            if (!currenttimeswitch_e.checked) currenttimeswitch_e.click()
            if (!massswitchswitch_e.checked) massswitchswitch_e.click()

            if (treswitch_e.checked) treswitch_e.click();
            if (!wswitch_e.checked) wswitch_e.click();
            if (!peswitch_e.checked) peswitch_e.click();
            if (foswitch_e.checked) foswitch_e.click();
            if (tilswitch_e.checked) tilswitch_e.click();

            onswitch_e.checked = true; localStorage.setItem('onswitchc', (onswitch_e.checked ? 'true' : 'false'))
            oonswitch_e.checked = true; localStorage.setItem('oonswitchc', (oonswitch_e.checked ? 'true' : 'false'))
            if (!osswitch_e.checked) osswitch_e.click();
            if (traswitch_e.checked) traswitch_e.click();

            if (!mapswitch_e.checked) mapswitch_e.click();
            if (!hmnswitch_e.checked) hmnswitch_e.click();
            if (!hmsswitch_e.checked) hmsswitch_e.click();
            if (!hmlswitch_e.checked) hmlswitch_e.click();
            if (!hmmsiswitch_e.checked) hmmsiswitch_e.click();

        }







        let giswitch_e = document.getElementById('gi-switch-e')
        let fps = document.getElementById('fps')
        giswitch_e.onclick = function () {
            giswitch_e.checked ? fps.style.display = 'block' : fps.style.display = 'none'
            localStorage.setItem('giswitchc', (giswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('giswitchc') == 'true') giswitch_e.checked = true
        else if (localStorage.getItem('giswitchc') == 'false') giswitch_e.checked = false
        if (!giswitch_e.checked) fps.style.display = 'none'
        else if (giswitch_e.checked) { fps.style.display = 'block' }

        let miswitch_e = document.getElementById('mi-switch-e')
        miswitch_e.onclick = function () {
            if (miswitch_e.checked) { fps.style.top = '10px'; fps.style.bottom = null; }
            else { fps.style.bottom = '10px'; fps.style.top = null; }
            localStorage.setItem('miswitchc', (miswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('miswitchc') == 'true') miswitch_e.checked = true
        else if (localStorage.getItem('miswitchc') == 'false') miswitch_e.checked = false
        if (!miswitch_e.checked) { fps.style.bottom = '10px'; fps.style.top = null; }
        if (miswitch_e.checked) { fps.style.bottom = null; fps.style.top = '10px'; }
        let hlswitch_e = document.getElementById('hl-switch-e')
        let leaderboard = document.querySelector('#game > div.top')
        hlswitch_e.onclick = function () {
            hlswitch_e.checked ? leaderboard.style.display = 'block' : leaderboard.style.display = 'none'
            localStorage.setItem('hlswitchc', (hlswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('hlswitchc') == 'true') hlswitch_e.checked = true
        else if (localStorage.getItem('hlswitchc') == 'false') hlswitch_e.checked = false;
        if (!hlswitch_e.checked) leaderboard.style.display = 'none'

        let teammatesswitch_e = document.getElementById('teammates-switch-e')
        let teammates = document.getElementById('teammates')
        teammatesswitch_e.onclick = function () {
            teammatesswitch_e.checked ? teammates.style.display = 'block' : teammates.style.display = 'none'
            localStorage.setItem('teammatesswitchc', (teammatesswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('teammatesswitchc') == 'true') teammatesswitch_e.checked = true
        else if (localStorage.getItem('teammatesswitchc') == 'false') teammatesswitch_e.checked = false
        if (!teammatesswitch_e.checked) teammates.style.display = 'none'
        let currenttimeswitch_e = document.getElementById('time-switch-e')
        let currentTime = document.getElementById('currentTime')
        currentTime.style.display = 'block'
        currenttimeswitch_e.onclick = function () {
            currenttimeswitch_e.checked ? currentTime.style.display = 'block' : currentTime.style.display = 'none'

            localStorage.setItem('currenttimeswitchc', (currenttimeswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('currenttimeswitchc') == 'true') currenttimeswitch_e.checked = true
        else if (localStorage.getItem('currenttimeswitchc') == 'false') currenttimeswitch_e.checked = false
        if (!currenttimeswitch_e.checked) currentTime.style.display = 'none'

        let massswitchswitch_e = document.getElementById('mass-switch-e')
        massswitchswitch_e.onclick = function () {
            setInterval(() => {
                if (document.getElementsByClassName('topmass').length) {
                    let topmass = document.getElementsByClassName('topmass')
                    for (let i = 0; i < topmass.length; i++) {
                        massswitchswitch_e.checked ? topmass[i].style.color = localStorage.getItem('leadm') : topmass[i].style.color = 'transparent'
                    }
                }
            }, 100)
            localStorage.setItem('massswitchswitchc', (massswitchswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('massswitchswitchc') == 'true') massswitchswitch_e.checked = true
        else if (localStorage.getItem('massswitchswitchc') == 'false') massswitchswitch_e.checked = false
        setInterval(() => {
            if (document.getElementsByClassName('topmass').length) {
                let topmass = document.getElementsByClassName('topmass')
                for (let i = 0; i < topmass.length; i++) {
                    massswitchswitch_e.checked ? topmass[i].style.color = localStorage.getItem('leadm') : topmass[i].style.color = 'transparent'
                }
            }
        }, 100)
        let smswitch_e = document.getElementById('sm-switch-e')
        smswitch_e.onclick = function () {
            setInterval(() => {
                if (document.getElementsByClassName('topmass').length) {
                    let topmass = document.getElementsByClassName('topmass')
                    for (let i = 0; i < topmass.length; i++) {
                        smswitch_e.checked ? topmass[i].innerHTML = abbreviateNumber(topmass[i].innerHTML) : topmass[i].innerHTML = topmass[i].textContent
                    }
                }
            }, 100)
            localStorage.setItem('smswitchc', (smswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('smswitchc') == 'true') smswitch_e.checked = true
        else if (localStorage.getItem('smswitchc') == 'false') smswitch_e.checked = false
        setInterval(() => {
            if (document.getElementsByClassName('topmass').length) {
                let topmass = document.getElementsByClassName('topmass')
                for (let i = 0; i < topmass.length; i++) {
                    smswitch_e.checked ? topmass[i].innerHTML = abbreviateNumber(topmass[i].innerHTML) : topmass[i].innerHTML = topmass[i].textContent
                }
            }
        }, 100)
        let treswitch_e = document.getElementById('tre-switch-e')
        treswitch_e.onclick = function () {
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].material && game.world.scene.children[i].material.type == "MeshLambertMaterial") {
                    if (game.world.scene.children[i].position.y != -250 && treswitch_e.checked == false) {
                        game.world.scene.children[i].position.y = -250
                    }
                    else if (treswitch_e.checked) {
                        game.world.scene.children[i].position.y = 0
                    }
                }
            }
            localStorage.setItem('treswitchc', (treswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('treswitchc') == 'true') treswitch_e.checked = true
        else if (localStorage.getItem('treswitchc') == 'false') treswitch_e.checked = false
        if (!treswitch_e.checked) {
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].material && game.world.scene.children[i].material.type == "MeshLambertMaterial") {
                    if (game.world.scene.children[i].position.y != -250 && treswitch_e.checked == false) {
                        game.world.scene.children[i].position.y = -250
                    }
                }
            }
        }
        let wswitch_e = document.getElementById('w-switch-e')
        wswitch_e.onclick = function () {
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].material && game.world.scene.children[i].material.type == "MultiMaterial") {
                    if (game.world.scene.children[i].material.visible == true && wswitch_e.checked == false) {
                        game.world.scene.children[i].material.visible = false
                    }
                    else if (wswitch_e.checked) {
                        game.world.scene.children[i].material.visible = true
                    }
                }
            }
            localStorage.setItem('wswitchc', (wswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('wswitchc') == 'true') wswitch_e.checked = true
        else if (localStorage.getItem('wswitchc') == 'false') wswitch_e.checked = false
        if (!wswitch_e.checked) {
            for (i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i].material && game.world.scene.children[i].material.type == "MultiMaterial") {
                    if (game.world.scene.children[i].material.visible == true && wswitch_e.checked == false) {
                        game.world.scene.children[i].material.visible = false
                    }
                }
            }

        }
        let peswitch_e = document.getElementById('pe-switch-e')
        peswitch_e.onclick = function () {
            if (peswitch_e.checked) {
                for (let i = 0; i < game.world.scene.children.length; i++) {
                    if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "IcosahedronGeometry") {
                        game.world.scene.children[i].material.visible = true
                    }
                }
            }
            else if (peswitch_e.checked == false) {
                for (let i = 0; i < game.world.scene.children.length; i++) {
                    if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "IcosahedronGeometry") {
                        game.world.scene.children[i].material.visible = false
                    }
                }
            }
            localStorage.setItem('peswitchc', (peswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('peswitchc') == 'true') peswitch_e.checked = true
        else if (localStorage.getItem('peswitchc') == 'false') peswitch_e.checked = false
        if (!peswitch_e.checked) {
            for (let i = 0; i < game.world.scene.children.length; i++) {
                if (game.world.scene.children[i] && game.world.scene.children[i].material && game.world.scene.children[i].material.type && game.world.scene.children[i].material.type == "MeshLambertMaterial" && game.world.scene.children[i].geometry.type == "IcosahedronGeometry") {
                    game.world.scene.children[i].material.visible = false
                }
            }
        }
        let foswitch_e = document.getElementById('fo-switch-e')
        foswitch_e.onclick = function () {
            if (fog == true) fog = false
            else fog = true
            localStorage.setItem('foswitchc', (foswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('foswitchc') == 'true') foswitch_e.checked = true
        else if (localStorage.getItem('foswitchc') == 'false') foswitch_e.checked = false
        if (!foswitch_e.checked) fog = false

        let tilswitch_e = document.getElementById('til-switch-e')
        tilswitch_e.onclick = function changeTiles() {
            if (floor == true) {
                toDataURL("https://i.imgur.com/94IixKn.png", function (dataUrl) {
                    var texture = new THREE.ImageUtils.loadTexture(dataUrl)
                    game.world.floor.material.map = texture
                    texture.minFilter = THREE.LinearFilter
                })
                floor = false
            }
            else {
                var texture = new THREE.ImageUtils.loadTexture("assets/images/bg010.jpg");
                game.world.floor.material.map = texture;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(50, 50);
                texture.minFilter = THREE.LinearFilter
                floor = true

            }
            localStorage.setItem('tilswitchc', (tilswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('tilswitchc') == 'true') tilswitch_e.checked = true
        else if (localStorage.getItem('tilswitchc') == 'false') tilswitch_e.checked = false
        if (!tilswitch_e.checked) {
            toDataURL("https://i.imgur.com/94IixKn.png", function (dataUrl) {
                var texture = new THREE.ImageUtils.loadTexture(dataUrl)
                game.world.floor.material.map = texture
                texture.minFilter = THREE.LinearFilter
            })
            floor = false
        }
        let onswitch_e = document.getElementById('on-switch-e')
        onswitch_e.onclick = function () {
            setInterval(() => {
                if (game.world.players && game.world.players[game.uid] && game.world.players[game.uid].nameMaterial) {
                    let player = game.world.players[game.uid]
                    if (!onswitch_e.checked) {

                        player.nameMaterial.visible = false
                    } else {
                        player.nameMaterial.visible = true
                    }
                }
            }, 100);


            localStorage.setItem('onswitchc', (onswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('onswitchc') == 'true') onswitch_e.checked = true
        else if (localStorage.getItem('onswitchc') == 'false') onswitch_e.checked = false
        setInterval(() => {
            if (game.world.players && game.world.players[game.uid] && game.world.players[game.uid].nameMaterial) {
                let player = game.world.players[game.uid]
                if (!onswitch_e.checked) {

                    player.nameMaterial.visible = false
                } else {
                    player.nameMaterial.visible = true
                }
            }
        }, 100)
        let oonswitch_e = document.getElementById('oon-switch-e')
        oonswitch_e.onclick = function hideOpponentNames() {
            setInterval(() => {
                for (let i in game.world.players) {
                    let p = game.world.players[i];
                    if (p.objs) {
                        for (var j = 0; j < p.objs.length; j++) {
                            if (p.nameMaterial) {
                                if (oonswitch_e.checked == true) {
                                    p.nameMaterial.visible = true
                                }
                                else if (oonswitch_e.checked == false) {
                                    p.nameMaterial.visible = false

                                }
                            }

                        }
                    }

                }
            }, 100);
            localStorage.setItem('oonswitchc', (oonswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('oonswitchc') == 'true') oonswitch_e.checked = true
        else if (localStorage.getItem('oonswitchc') == 'false') oonswitch_e.checked = false
        setInterval(() => {
            for (let i in game.world.players) {
                let p = game.world.players[i];
                if (p.objs) {
                    for (var j = 0; j < p.objs.length; j++) {
                        if (p.nameMaterial) {
                            if (oonswitch_e.checked == false) {
                                p.nameMaterial.visible = false

                            }
                        }

                    }
                }

            }
        }, 100);
        let osswitch_e = document.getElementById('os-switch-e')
        osswitch_e.onclick = function toggleOpponentSkins() {
            setInterval(() => {
                for (var i in game.world.players) {
                    var p = game.world.players[i];
                    if (p.objs) {
                        for (var j = 0; j < p.objs.length; j++) {
                            if (p.skinMaterial && p.skinMaterial.map && p.skinMaterial.map.offset.y != 10 && osswitch_e.checked == false) {
                                p.skinMaterial.map = new THREE.ImageUtils.loadTexture("/assets/images/skins/eye.jpg");
                                p.skinMaterial.map.offset.y = 10
                                p.skinMaterial.color = new THREE.Color(Math.floor(Math.random() * 2), Math.floor(Math.random() * 2), Math.floor(Math.random() * 2))
                            }
                            else if (osswitch_e.checked == true && p.skinMaterial && p.skinMaterial.map && p.skinMaterial.map.offset.y == 10) {
                                p.skinMaterial.map = new THREE.ImageUtils.loadTexture("/assets/images/skins/" + p.skin + ".jpg");
                                p.skinMaterial.color = new THREE.Color(1, 1, 1)
                            }
                        }
                    }
                }
            }, 100);

            localStorage.setItem('osswitchc', (osswitch_e.checked ? 'true' : 'false'))

        }
        if (localStorage.getItem('osswitchc') == 'true') osswitch_e.checked = true
        else if (localStorage.getItem('osswitchc') == 'false') osswitch_e.checked = false
        setInterval(() => {
            for (var i in game.world.players) {
                var p = game.world.players[i];
                if (p.objs) {
                    for (var j = 0; j < p.objs.length; j++) {
                        if (p.skinMaterial && p.skinMaterial.map && p.skinMaterial.map.offset.y != 10 && osswitch_e.checked == false) {
                            p.skinMaterial.map = new THREE.ImageUtils.loadTexture("/assets/images/skins/eye.jpg");
                            p.skinMaterial.map.offset.y = 10
                            p.skinMaterial.color = new THREE.Color(Math.floor(Math.random() * 2), Math.floor(Math.random() * 2), Math.floor(Math.random() * 2))
                        }
                    }
                }
            }
        }, 100);
        let traswitch_e = document.getElementById('tra-switch-e')
        traswitch_e.onclick = function () {
            setInterval(() => {
                for (var i in game.world.players) {
                    var p = game.world.players[i]
                    if (p.objs) {
                        for (var j = 0; j < p.objs.length; j++) {
                            if (traswitch_e.checked == true) {
                                p.material.transparent = true
                                p.material.opacity = 0.3

                            } else if (traswitch_e.checked == false) {
                                p.material.transparent = false
                                p.material.opacity = 0
                            }
                        }
                    }

                }
            }, 100);
            localStorage.setItem('traswitchc', (traswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('traswitchc') == 'true') traswitch_e.checked = true
        else if (localStorage.getItem('traswitchc') == 'false') traswitch_e.checked = false
        setInterval(() => {
            for (var i in game.world.players) {
                var p = game.world.players[i]
                if (p.objs) {
                    for (var j = 0; j < p.objs.length; j++) {
                        if (traswitch_e.checked == true) {
                            p.material.transparent = true
                            p.material.opacity = 0.3

                        }
                    }
                }

            }
        }, 100);
        let mapswitch_e = document.getElementById('map-switch-e')
        let minimapContainer = document.getElementById('minimap-container')
        mapswitch_e.onclick = function () {
            mapswitch_e.checked ? minimapContainer.style.display = 'block' : minimapContainer.style.display = 'none'
            localStorage.setItem('mapswitchc', (mapswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('mapswitchc') == 'true') mapswitch_e.checked = true
        else if (localStorage.getItem('mapswitchc') == 'false') mapswitch_e.checked = false
        if (!document.getElementById('map-switch-e').checked) minimapContainer.style.display = 'none'
        let hmnswitch_e = document.getElementById('hmn-switch-e')
        hmnswitch_e.onclick = function () {
            localStorage.setItem('hmnswitchc', (hmnswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('hmnswitchc') == 'true') hmnswitch_e.checked = true
        else if (localStorage.getItem('hmnswitchc') == 'false') hmnswitch_e.checked = false
        let hmsswitch_e = document.getElementById('hms-switch-e')
        hmsswitch_e.onclick = function () {
            localStorage.setItem('hmsswitchc', (hmsswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('hmsswitchc') == 'true') hmsswitch_e.checked = true
        else if (localStorage.getItem('hmsswitchc') == 'false') hmsswitch_e.checked = false
        let hmlswitch_e = document.getElementById('hml-switch-e')
        hmlswitch_e.onclick = function () {
            localStorage.setItem('hmlswitchc', (hmlswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('hmlswitchc') == 'true') hmlswitch_e.checked = true
        else if (localStorage.getItem('hmlswitchc') == 'false') hmlswitch_e.checked = false
        let hmmsiswitch_e = document.getElementById('hmmsi-switch-e')
        let sectorIndicator = document.getElementById('sector-location')
        hmmsiswitch_e.onclick = function () {
            hmmsiswitch_e.checked ? sectorIndicator.style.display = 'block' : sectorIndicator.style.display = 'none'
            localStorage.setItem('hmmsiswitchc', (hmmsiswitch_e.checked ? 'true' : 'false'))
        }
        if (localStorage.getItem('hmmsiswitchc') == 'true') hmmsiswitch_e.checked = true
        else if (localStorage.getItem('hmmsiswitchc') == 'false') hmmsiswitch_e.checked = false
        if (!document.getElementById('hmmsi-switch-e').checked) sectorIndicator.style.display = 'none'

        socket = io.connect('https://biomium.onrender.com')

        socket.on('connect', () => {
            if (alive) {
                let player = game.world.players[game.uid]
                if (!player) return
                socket.emit('spawn', player.name, player.objs)
            }
            if (document.getElementById('biomium-tag').value === "") socket.emit('room', 'none')
            else socket.emit('room', document.getElementById('biomium-tag').value)
        })

        socket.on('players', plrs => {
            players = plrs
        })


        unsafeWindow.game.setMode = hkSetMode
        unsafeWindow.game.world.render = hkRender
        unsafeWindow.game.onTargetFPS(game.targetFPS = 120)
    }
    unsafeWindow.addEventListener('load', init)
}
