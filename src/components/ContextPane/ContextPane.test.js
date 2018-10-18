import React from 'react';
import ContextPane from './ContextPane';
import { stageFocusType } from '../../../src/enums';
import PlantableItems from '../PlantableItems';
import { shallow } from 'enzyme';
import assert from 'assert';

let component;

const getContextPane = (props = {}) => (
  <ContextPane
    {...{
      handlers: {
        handleSelectPlantableItem: () => {},
        ...props.handlers,
      },
      state: {
        selectedPlantableItemId: '',
        stageFocus: stageFocusType.NONE,
        plantableInventory: [],
        ...props.state,
      },
    }}
  />
);

beforeEach(() => {
  component = shallow(getContextPane());
});

describe('conditional UI', () => {
  describe('stageFocus', () => {
    describe('stageFocus === stageFocusType.FIELD', () => {
      beforeEach(() => {
        component = shallow(
          getContextPane({ state: { stageFocus: stageFocusType.FIELD } })
        );
      });

      it('renders relevant UI', () => {
        assert.equal(component.find(PlantableItems).length, 1);
      });
    });
  });
});