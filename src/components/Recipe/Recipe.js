import React from 'react';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardActions from '@material-ui/core/CardActions';
import { array, func, object } from 'prop-types';

import { itemsMap } from '../../data/maps';
import { dishes } from '../../img';

import FarmhandContext from '../../Farmhand.context';

import './Recipe.sass';

/**
 * @param {farmhand.recipe} recipe
 * @param {Array.<farmhand.item>} inventory
 * @returns {boolean}
 */
export const canMakeRecipe = ({ ingredients }, inventory) => {
  const inventoryLookup = inventory.reduce((acc, { id, quantity }) => {
    acc[id] = quantity;
    return acc;
  }, {});

  return Object.keys(ingredients).every(
    itemId => (inventoryLookup[itemId] || 0) >= ingredients[itemId]
  );
};

const IngredientsList = ({ recipe: { ingredients, name } }) => (
  <ul {...{ title: `Ingredients for ${name}` }}>
    {Object.keys(ingredients).map(itemId => (
      <li {...{ key: itemId }}>
        {ingredients[itemId]} x {itemsMap[itemId].name}
      </li>
    ))}
  </ul>
);

const Recipe = ({
  handleMakeRecipeClick,
  inventory,
  recipe,
  recipe: { id, name },
}) => (
  <Card {...{ className: 'Recipe' }}>
    <CardHeader
      {...{
        avatar: <img {...{ src: dishes[id], alt: name }} />,
        title: name,
        subheader: <IngredientsList {...{ recipe }} />,
      }}
    />
    <CardActions>
      <Button
        {...{
          className: 'make-recipe',
          color: 'primary',
          disabled: !canMakeRecipe(recipe, inventory),
          onClick: () => handleMakeRecipeClick(recipe),
          variant: 'contained',
        }}
      >
        Make
      </Button>
    </CardActions>
  </Card>
);

Recipe.propTypes = {
  handleMakeRecipeClick: func.isRequired,
  inventory: array.isRequired,
  recipe: object.isRequired,
};

// export default Recipe;
export default function Consumer(props) {
  return (
    <FarmhandContext.Consumer>
      {({ gameState, handlers }) => (
        <Recipe {...{ ...gameState, ...handlers, ...props }} />
      )}
    </FarmhandContext.Consumer>
  );
}
