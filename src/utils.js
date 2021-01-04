import Dinero from 'dinero.js'
import fastMemoize from 'fast-memoize'
import sortBy from 'lodash.sortby'

import shopInventory from './data/shop-inventory'
import fruitNames from './data/fruit-names'
import { cropIdToTypeMap, itemsMap } from './data/maps'
import {
  chocolateMilk,
  milk1,
  milk2,
  milk3,
  rainbowMilk1,
  rainbowMilk2,
  rainbowMilk3,
} from './data/items'
import { levels } from './data/levels'
import { unlockableItems } from './data/levels'
import { items as itemImages } from './img'
import {
  cowColors,
  cropLifeStage,
  genders,
  itemType,
  standardCowColors,
} from './enums'
import {
  BREAKPOINTS,
  COW_MAXIMUM_AGE_VALUE_DROPOFF,
  COW_MAXIMUM_VALUE_MULTIPLIER,
  COW_MILK_RATE_FASTEST,
  COW_MILK_RATE_SLOWEST,
  COW_MINIMUM_VALUE_MULTIPLIER,
  COW_STARTING_WEIGHT_BASE,
  COW_STARTING_WEIGHT_VARIANCE,
  COW_WEIGHT_MULTIPLIER_MAXIMUM,
  COW_WEIGHT_MULTIPLIER_MINIMUM,
  DAILY_FINANCIAL_HISTORY_RECORD_LENGTH,
  HUGGING_MACHINE_ITEM_ID,
  INITIAL_FIELD_HEIGHT,
  INITIAL_FIELD_WIDTH,
  INITIAL_SPRINKLER_RANGE,
  MALE_COW_WEIGHT_MULTIPLIER,
  MEMOIZE_CACHE_CLEAR_THRESHOLD,
  PRICE_EVENT_STANDARD_DURATION_DECREASE,
} from './constants'

const { SEED, GROWING, GROWN } = cropLifeStage

const shopInventoryMap = shopInventory.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

export const chooseRandom = list =>
  list[Math.round(Math.random() * (list.length - 1))]

// Ensures that the condition argument to memoize() is not ignored, per
// https://github.com/caiogondim/fast-memoize.js#function-arguments
//
// Pass this is the `serializer` option to any memoize()-ed functions that
// accept function arguments.
const memoizationSerializer = args =>
  JSON.stringify(
    [...args].map(arg => (typeof arg === 'function' ? arg.toString() : arg))
  )

/**
 * @returns {string}
 */
const createUniqueId = () => btoa(Math.random() + Date.now())

// This is basically the same as fast-memoize's default cache, except that it
// clears the cache once the size exceeds MEMOIZE_CACHE_CLEAR_THRESHOLD to
// prevent memory bloat.
// https://github.com/caiogondim/fast-memoize.js/blob/5cdfc8dde23d86b16e0104bae1b04cd447b98c63/src/index.js#L114-L128
class MemoizeCache {
  cache = {}

  /**
   * @param {Object} [config] Can also contain the config options used to
   * configure fast-memoize.
   * @param {number} [config.cacheSize]
   * @see https://github.com/caiogondim/fast-memoize.js
   */
  constructor({ cacheSize = MEMOIZE_CACHE_CLEAR_THRESHOLD } = {}) {
    this.cacheSize = cacheSize
  }

  has(key) {
    return key in this.cache
  }

  get(key) {
    return this.cache[key]
  }

  set(key, value) {
    if (Object.keys(this.cache).length > this.cacheSize) {
      this.cache = {}
    }

    this.cache[key] = value
  }
}

export const memoize = (fn, config) =>
  fastMemoize(fn, {
    cache: { create: () => new MemoizeCache(config) },
    ...config,
  })

/**
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
export const clampNumber = (num, min, max) =>
  num <= min ? min : num >= max ? max : num

export const castToMoney = num => Math.round(num * 100) / 100

/**
 * Safely adds dollar figures to avoid IEEE 754 rounding errors.
 * @param {...number} num Numbers that represent money values.
 * @returns {number}
 * @see http://adripofjavascript.com/blog/drips/avoiding-problems-with-decimal-math-in-javascript.html
 */
export const moneyTotal = (...args) =>
  args.reduce((sum, num) => (sum += Math.round(num * 100)), 0) / 100

/**
 * Based on https://stackoverflow.com/a/14224813/470685
 * @param {number} value Number to scale
 * @param {number} min Non-standard minimum
 * @param {number} max Non-standard maximum
 * @param {number} baseMin Standard minimum
 * @param {number} baseMax Standard maximum
 * @returns {number}
 */
const scaleNumber = (value, min, max, baseMin, baseMax) =>
  ((value - min) * (baseMax - baseMin)) / (max - min) + baseMin

export const createNewField = () =>
  new Array(INITIAL_FIELD_HEIGHT)
    .fill(undefined)
    .map(() => new Array(INITIAL_FIELD_WIDTH).fill(null))

/**
 * @param {number} number
 * @returns {string} Include dollar sign and other formatting, as well as cents.
 */
export const moneyString = number =>
  Dinero({ amount: Math.round(number * 100) }).toFormat()

/**
 * @param {number} number
 * @param {string} format
 * @see https://dinerojs.com/module-dinero#~toFormat
 * @returns {string}
 */
const formatNumber = (number, format) =>
  Dinero({ amount: Math.round(number * 100), precision: 2 })
    .convertPrecision(0)
    .toFormat(format)

/**
 * @param {number} number
 * @returns {string} Include dollar sign and other formatting. Cents are
 * rounded off.
 */
export const dollarString = number => formatNumber(number, '$0,0')

/**
 * @param {number} number
 * @returns {string} Number string with commas.
 */
export const integerString = number => formatNumber(number, '0,0')

/**
 * @param {string} itemId
 * @returns {number}
 */
const getItemBaseValue = itemId => itemsMap[itemId].value

/**
 * @param {farmhand.item} item
 * @param {Object.<number>} valueAdjustments
 * @returns {number}
 */
export const getItemCurrentValue = ({ id }, valueAdjustments) =>
  Dinero({
    amount: Math.round(
      (valueAdjustments[id]
        ? getItemBaseValue(id) *
          (itemsMap[id].doesPriceFluctuate ? valueAdjustments[id] : 1)
        : getItemBaseValue(id)) * 100
    ),
    precision: 2,
  }).toUnit()

/**
 * @param {Object} valueAdjustments
 * @param {string} itemId
 * @returns {number} Rounded to a money value.
 */
export const getAdjustedItemValue = (valueAdjustments, itemId) =>
  Number(((valueAdjustments[itemId] || 1) * itemsMap[itemId].value).toFixed(2))

/**
 * @param {farmhand.item} item
 * @returns {boolean}
 */
export const isItemSoldInShop = ({ id }) => Boolean(shopInventoryMap[id])

/**
 * @param {farmhand.item} item
 * @returns {number}
 */
export const getResaleValue = ({ id }) => itemsMap[id].value / 2

/**
 * @param {string} itemId
 * @returns {farmhand.crop}
 */
export const getCropFromItemId = itemId => ({
  ...getPlotContentFromItemId(itemId),
  daysOld: 0,
  daysWatered: 0,
  isFertilized: false,
  wasWateredToday: false,
})

/**
 * @param {string} itemId
 * @returns {farmhand.plotContent}
 */
export const getPlotContentFromItemId = itemId => ({
  itemId,
})

/**
 * @param {farmhand.plotContent} plotContent
 * @returns {string}
 */
export const getPlotContentType = ({ itemId }) => itemsMap[itemId].type

/**
 * @param {?farmhand.plotContent} plot
 * @returns {boolean}
 */
export const doesPlotContainCrop = plot =>
  plot && getPlotContentType(plot) === itemType.CROP

/**
 * @param {farmhand.item} item
 * @returns {boolean}
 */
export const isItemAGrownCrop = item =>
  Boolean(item.type === itemType.CROP && !item.growsInto)

/**
 * @param {farmhand.item} item
 * @returns {boolean}
 */
export const isItemAFarmProduct = item =>
  Boolean(
    isItemAGrownCrop(item) ||
      item.type === itemType.MILK ||
      item.type === itemType.CRAFTED_ITEM
  )

/**
 * @param {farmhand.crop} crop
 * @returns {string}
 */
export const getCropId = ({ itemId }) =>
  cropIdToTypeMap[itemsMap[itemId].cropType]

/**
 * @param {farmhand.crop} crop
 * @returns {number}
 */
export const getCropLifecycleDuration = memoize(({ cropTimetable }) =>
  Object.values(cropTimetable).reduce((acc, value) => acc + value, 0)
)

/**
 * @param {farmhand.cropTimetable} cropTimetable
 * @returns {Array.<enums.cropLifeStage>}
 */
export const getLifeStageRange = memoize(cropTimetable =>
  [SEED, GROWING].reduce(
    (acc, stage) => acc.concat(Array(cropTimetable[stage]).fill(stage)),
    []
  )
)

/**
 * @param {farmhand.crop} crop
 * @returns {enums.cropLifeStage}
 */
export const getCropLifeStage = ({ itemId, daysWatered }) =>
  getLifeStageRange(itemsMap[itemId].cropTimetable)[Math.floor(daysWatered)] ||
  GROWN

const cropLifeStageToImageSuffixMap = {
  [SEED]: 'seed',
  [GROWING]: 'growing',
}

/**
 * @param {farmhand.plotContent} plotContent
 * @returns {?string}
 */
export const getPlotImage = plotContent =>
  plotContent
    ? getPlotContentType(plotContent) === itemType.CROP
      ? getCropLifeStage(plotContent) === GROWN
        ? itemImages[getCropId(plotContent)]
        : itemImages[
            `${getCropId(plotContent)}-${
              cropLifeStageToImageSuffixMap[getCropLifeStage(plotContent)]
            }`
          ]
      : itemImages[plotContent.itemId]
    : null

/**
 * @param {number} rangeSize
 * @param {number} centerX
 * @param {number} centerY
 * @returns {Array.<Array.<?farmhand.plotContent>>}
 */
export const getRangeCoords = (rangeSize, centerX, centerY) => {
  const squareSize = 2 * rangeSize + 1
  const rangeStartX = centerX - rangeSize
  const rangeStartY = centerY - rangeSize

  return new Array(squareSize)
    .fill()
    .map((_, y) =>
      new Array(squareSize)
        .fill()
        .map((_, x) => ({ x: rangeStartX + x, y: rangeStartY + y }))
    )
}

/**
 * @param {string} seedItemId
 * @returns {string}
 */
export const getFinalCropItemIdFromSeedItemId = seedItemId =>
  itemsMap[seedItemId].growsInto

/**
 * @param {farmhand.item} seedItem
 * @returns {farmhand.item}
 */
export const getFinalCropItemFromSeedItem = ({ id }) =>
  itemsMap[getFinalCropItemIdFromSeedItemId(id)]

/**
 * @param {farmhand.priceEvent} priceCrashes
 * @param {farmhand.priceEvent} priceSurges
 * @returns {Object}
 */
export const generateValueAdjustments = (priceCrashes, priceSurges) =>
  Object.keys(itemsMap).reduce((acc, key) => {
    if (itemsMap[key].doesPriceFluctuate) {
      if (priceCrashes[key]) {
        acc[key] = 0.5
      } else if (priceSurges[key]) {
        acc[key] = 1.5
      } else {
        acc[key] = Math.random() + 0.5
      }
    }

    return acc
  }, {})

/**
 * Generates a friendly cow.
 * @param {Object} [options]
 * @returns {farmhand.cow}
 */
export const generateCow = (options = {}) => {
  const gender = options.gender || chooseRandom(Object.values(genders))

  const baseWeight = Math.round(
    COW_STARTING_WEIGHT_BASE *
      (gender === genders.MALE ? MALE_COW_WEIGHT_MULTIPLIER : 1) -
      COW_STARTING_WEIGHT_VARIANCE +
      Math.random() * (COW_STARTING_WEIGHT_VARIANCE * 2)
  )

  const color = options.color || chooseRandom(Object.values(standardCowColors))

  return {
    baseWeight,
    color,
    colorsInBloodline: { [color]: true },
    daysOld: 1,
    daysSinceMilking: 0,
    gender,
    happiness: 0,
    happinessBoostsToday: 0,
    id: createUniqueId(),
    isBred: false,
    isUsingHuggingMachine: false,
    name: chooseRandom(fruitNames),
    weightMultiplier: 1,
    ...options,
  }
}

/**
 * Generates a cow based on two parents.
 * @param {farmhand.cow} cow1
 * @param {farmhand.cow} cow2
 * @returns {farmhand.cow}
 */
export const generateOffspringCow = (cow1, cow2) => {
  if (cow1.gender === cow2.gender) {
    throw new Error(
      `${JSON.stringify(cow1)} ${JSON.stringify(
        cow2
      )} cannot produce offspring because they have the same gender`
    )
  }

  const maleCow = cow1.gender === genders.MALE ? cow1 : cow2
  const femaleCow = cow1.gender === genders.MALE ? cow2 : cow1
  const colorsInBloodline = {
    // These lines are for backwards compatibility and can be removed on 11/1/2020
    [maleCow.color]: true,
    [femaleCow.color]: true,
    // End backwards compatibility lines to remove
    ...maleCow.colorsInBloodline,
    ...femaleCow.colorsInBloodline,
  }

  delete colorsInBloodline[cowColors.RAINBOW]

  const isRainbowCow =
    Object.keys(colorsInBloodline).length ===
    Object.keys(standardCowColors).length

  return generateCow({
    color: isRainbowCow
      ? cowColors.RAINBOW
      : chooseRandom([femaleCow.color, maleCow.color]),
    colorsInBloodline,
    baseWeight: (maleCow.baseWeight + femaleCow.baseWeight) / 2,
    isBred: true,
    ...(isRainbowCow && { gender: genders.FEMALE }),
  })
}

/**
 * @param {farmhand.cow} cow
 * @returns {farmhand.item}
 */
export const getCowMilkItem = ({ color, happiness }) => {
  if (color === cowColors.BROWN) {
    return chocolateMilk
  }

  const isRainbowCow = color === cowColors.RAINBOW

  if (happiness < 1 / 3) {
    return isRainbowCow ? rainbowMilk1 : milk1
  } else if (happiness < 2 / 3) {
    return isRainbowCow ? rainbowMilk2 : milk2
  }

  return isRainbowCow ? rainbowMilk3 : milk3
}

/**
 * @param {farmhand.cow} cow
 * @returns {number}
 */
export const getCowMilkRate = cow =>
  cow.gender === genders.FEMALE
    ? scaleNumber(
        cow.weightMultiplier,
        COW_WEIGHT_MULTIPLIER_MINIMUM,
        COW_WEIGHT_MULTIPLIER_MAXIMUM,
        COW_MILK_RATE_SLOWEST,
        COW_MILK_RATE_FASTEST
      )
    : Infinity

/**
 * @param {farmhand.cow} cow
 * @returns {number}
 */
export const getCowWeight = ({ baseWeight, weightMultiplier }) =>
  Math.round(baseWeight * weightMultiplier)

/**
 * @param {farmhand.cow} cow
 * @returns {number}
 */
export const getCowValue = cow =>
  getCowWeight(cow) *
  clampNumber(
    scaleNumber(
      cow.daysOld,
      1,
      COW_MAXIMUM_AGE_VALUE_DROPOFF,
      COW_MAXIMUM_VALUE_MULTIPLIER,
      COW_MINIMUM_VALUE_MULTIPLIER
    ),
    COW_MINIMUM_VALUE_MULTIPLIER,
    COW_MAXIMUM_VALUE_MULTIPLIER
  )

/**
 * @param {Array.<farmhand.item>} inventory
 * @returns {Object}
 */
const getInventoryQuantityMap = memoize(inventory =>
  inventory.reduce((acc, { id, quantity }) => {
    acc[id] = quantity
    return acc
  }, {})
)

/**
 * @param {farmhand.recipe} recipe
 * @param {Array.<farmhand.item>} inventory
 * @returns {number}
 */
export const maxYieldOfRecipe = memoize(({ ingredients }, inventory) => {
  const inventoryQuantityMap = getInventoryQuantityMap(inventory)

  return (
    Math.min(
      ...Object.keys(ingredients).map(itemId =>
        Math.floor(inventoryQuantityMap[itemId] / ingredients[itemId])
      )
    ) || 0
  )
})

/**
 * @param {farmhand.recipe} recipe
 * @param {Array.<farmhand.item>} inventory
 * @param {number} howMany
 * @returns {boolean}
 */
export const canMakeRecipe = (recipe, inventory, howMany) =>
  maxYieldOfRecipe(recipe, inventory) >= howMany

/**
 * @param {Array.<string>} itemIds
 * @returns {Array.<string>}
 */
export const filterItemIdsToSeeds = itemsIds =>
  itemsIds.filter(id => itemsMap[id].type === itemType.CROP)

/**
 * @param {Array.<string>} unlockedSeedItemIds
 * @returns {farmhand.item}
 */
export const getRandomUnlockedCrop = unlockedSeedItemIds =>
  itemsMap[getFinalCropItemIdFromSeedItemId(chooseRandom(unlockedSeedItemIds))]

/**
 * @param {farmhand.item} cropItem
 * @returns {farmhand.priceEvent}
 */
export const getPriceEventForCrop = cropItem => ({
  itemId: cropItem.id,
  daysRemaining:
    getCropLifecycleDuration(cropItem) - PRICE_EVENT_STANDARD_DURATION_DECREASE,
})

/**
 * @param {Array.<Array.<?farmhand.plotContent>>} field
 * @param {function(?farmhand.plotContent)} condition
 * @returns {?farmhand.plotContent}
 */
export const findInField = memoize(
  (field, condition) => field.find(row => row.find(condition)) || null,
  {
    serializer: memoizationSerializer,
  }
)

// This is currently unused, but it could be useful later.
/**
 * @param {Array.<Array.<?farmhand.plotContent>>} field
 * @param {function(?farmhand.plotContent)} filterCondition
 * @returns {Array.<Array.<?farmhand.plotContent>>}
 */
export const getCrops = memoize(
  (field, filterCondition) =>
    field.reduce((acc, row) => {
      acc.push(...row.filter(filterCondition))

      return acc
    }, []),
  {
    serializer: memoizationSerializer,
  }
)

/**
 * @returns {boolean}
 */
export const doesMenuObstructStage = () => window.innerWidth < BREAKPOINTS.MD

const itemTypesToShowInReverse = new Set([itemType.MILK])

const sortItemIdsByTypeAndValue = memoize(itemIds =>
  sortBy(itemIds, [
    id => Number(itemsMap[id].type !== itemType.CROP),
    id => {
      const { type, value } = itemsMap[id]
      return itemTypesToShowInReverse.has(type) ? -value : value
    },
  ])
)

/**
 * @param {Array.<farmhand.item>} items
 * @return {Array.<farmhand.item>}
 */
export const sortItems = items => {
  const map = {}
  items.forEach(item => (map[item.id] = item))

  return sortItemIdsByTypeAndValue(items.map(({ id }) => id)).map(id => map[id])
}

/**
 * @param {Array.<farmhand.item>} inventory
 * @returns {number}
 */
export const inventorySpaceConsumed = memoize(inventory =>
  inventory.reduce((sum, { quantity }) => sum + quantity, 0)
)

/**
 * @param {{ inventory: Array.<farmhand.item>, inventoryLimit: number}} state
 * @returns {number}
 */
export const inventorySpaceRemaining = ({ inventory, inventoryLimit }) =>
  inventoryLimit === -1
    ? Infinity
    : inventoryLimit - inventorySpaceConsumed(inventory)

/**
 * @param {{ inventory: Array.<farmhand.item>, inventoryLimit: number}} state
 * @returns {boolean}
 */
export const doesInventorySpaceRemain = ({ inventory, inventoryLimit }) =>
  inventorySpaceRemaining({ inventory, inventoryLimit }) > 0

/**
 * @param {Array.<farmhand.item>} inventory
 * @return {boolean}
 */
export const areHuggingMachinesInInventory = memoize(inventory =>
  inventory.some(({ id }) => id === HUGGING_MACHINE_ITEM_ID)
)

/**
 * @param {number} arraySize
 * @returns {Array.<null>}
 */
export const nullArray = memoize(
  arraySize => Object.freeze(new Array(arraySize).fill(null)),
  {
    cacheSize: 30,
  }
)

/**
 * @param {Array.<farmhand.cow>} cowInventory
 * @param {string} id
 * @returns {farmhand.cow|undefined}
 */
export const findCowById = memoize((cowInventory, id) =>
  cowInventory.find(cow => id === cow.id)
)

/**
 * @param {Object.<number>} itemsSold
 * @returns {number}
 */
export const farmProductsSold = memoize(itemsSold =>
  Object.entries(itemsSold).reduce(
    (sum, [itemId, numberSold]) =>
      sum + (isItemAFarmProduct(itemsMap[itemId]) ? numberSold : 0),
    0
  )
)

/**
 * @param {number} farmProductsSold
 * @returns {number}
 */
export const levelAchieved = farmProductsSold =>
  Math.floor(Math.sqrt(farmProductsSold) / 10) + 1

/**
 * @param {number} targetLevel
 * @returns {number}
 */
export const farmProductSalesVolumeNeededForLevel = targetLevel =>
  ((targetLevel - 1) * 10) ** 2

/**
 * @param {number} levelNumber
 * @returns {Object} Contains `sprinklerRange` and keys that correspond to
 * unlocked items.
 */
export const getLevelEntitlements = memoize(levelNumber => {
  const acc = {
    sprinklerRange: INITIAL_SPRINKLER_RANGE,
    items: {},
  }

  // Assumes that levels is sorted by id.
  levels.find(({ unlocksShopItem, id, increasesSprinklerRange }) => {
    if (increasesSprinklerRange) {
      acc.sprinklerRange++
    }

    if (unlocksShopItem) {
      acc.items[unlocksShopItem] = true
    }

    return id === levelNumber
  })

  return acc
})

/**
 * @param {Object} levelEntitlements
 * @returns {Array.<{ item: farmhand.item }>}
 */
export const getAvailbleShopInventory = memoize(levelEntitlements =>
  shopInventory.filter(
    ({ id }) =>
      !(
        unlockableItems.hasOwnProperty(id) &&
        !levelEntitlements.items.hasOwnProperty(id)
      )
  )
)

/**
 * @param {number} level
 * @returns {farmhand.item} Will always be a crop seed item.
 */
export const getRandomLevelUpReward = level =>
  itemsMap[
    chooseRandom(
      filterItemIdsToSeeds(Object.keys(getLevelEntitlements(level).items))
    )
  ]

/**
 * @param {number} level
 * @returns {number}
 */
export const getRandomLevelUpRewardQuantity = level => level * 10

/**
 * @param {Object} state
 * @returns {Object} A version of `state` that only contains keys of
 * farmhand.state data that should be persisted.
 */
export const reduceByPersistedKeys = state => {
  return [
    'cowForSale',
    'completedAchievements',
    'cowBreedingPen',
    'cowInventory',
    'cowColorsPurchased',
    'cowsSold',
    'cropsHarvested',
    'dayCount',
    'farmName',
    'field',
    'historicalDailyLosses',
    'historicalDailyRevenue',
    'historicalValueAdjustments',
    'inventory',
    'inventoryLimit',
    'itemsSold',
    'learnedRecipes',
    'loanBalance',
    'money',
    'newDayNotifications',
    'notificationLog',
    'purchasedCowPen',
    'purchasedField',
    'priceCrashes',
    'priceSurges',
    'profitabilityStreak',
    'record7dayProfitAverage',
    'recordProfitabilityStreak',
    'revenue',
    'todaysLosses',
    'todaysRevenue',
    'valueAdjustments',
  ].reduce((acc, key) => {
    // This check prevents old exports from corrupting game state when
    // imported.
    if (typeof state[key] !== 'undefined') {
      acc[key] = state[key]
    }

    return acc
  }, {})
}

/**
 * @param {Array.<number>} historicalData Must be no longer than 7 numbers long.
 * @return {number}
 */
export const get7DayAverage = historicalData =>
  historicalData.reduce((sum, revenue) => moneyTotal(sum, revenue), 0) /
  DAILY_FINANCIAL_HISTORY_RECORD_LENGTH

const cowColorToIdMap = {
  [cowColors.BLUE]: 'blue',
  [cowColors.BROWN]: 'brown',
  [cowColors.GREEN]: 'green',
  [cowColors.ORANGE]: 'orange',
  [cowColors.PURPLE]: 'purple',
  [cowColors.RAINBOW]: 'rainbow',
  [cowColors.WHITE]: 'white',
  [cowColors.YELLOW]: 'yellow',
}

export const getCowColorId = ({ color }) => `${cowColorToIdMap[color]}-cow`

/**
 * @param {number} todaysRevenue
 * @param {number} todaysLosses
 * @return {number}
 */
export const getTodaysProfit = (todaysRevenue, todaysLosses) =>
  moneyTotal(todaysRevenue, todaysLosses)
