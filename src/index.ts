import './style.css'
import Game from './components/Game'

function init(): void {
    const container = document.getElementById('root')
    if (!container) {
        throw new Error("Could not find '#root' container element.")
    }
    new Game(container)
}

init()
