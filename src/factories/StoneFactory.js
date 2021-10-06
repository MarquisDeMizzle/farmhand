import { coal, stone } from '../data/ores'
import { COAL_SPAWN_CHANCE } from '../constants'

/**
 * Resource factory used for spawning stone
 * @constructor
 */
export default class StoneFactory {
  /**
   * Generate resources
   * @returns {Array} an array of stone and coal resources
   */
  generate() {
    let diceRoll = Math.random()
    let resources = []

    resources.push(this.spawnStone())

    if (diceRoll <= COAL_SPAWN_CHANCE) {
      resources.push(this.spawnCoal())
    }

    return resources
  }

  /**
   * Spawn a piece of stone
   * @returns {Object} stone item
   * @private
   */
  spawnStone() {
    return stone
  }

  /**
   * Spawn a piece of coal
   * @returns {Object} coal item
   * @private
   */
  spawnCoal() {
    return coal
  }
}