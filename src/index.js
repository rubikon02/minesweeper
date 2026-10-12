import './style.css'
import Game from './components/Game'

function init() {
    const container = document.getElementById('root')
    new Game(container)
}

init()

