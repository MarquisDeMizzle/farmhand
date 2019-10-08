import React from 'react';
import { shallow } from 'enzyme';
import Button from '@material-ui/core/Button';

import { generateCow } from '../../utils';
import { PURCHASEABLE_COW_PENS } from '../../constants';
import { cowColors } from '../../enums';

import {
  CowPenContextMenu,
  CowCard,
  CowCardSubheader,
} from './CowPenContextMenu';

let component;

describe('CowPenContextMenu', () => {
  beforeEach(() => {
    component = shallow(
      <CowPenContextMenu
        {...{
          cowForSale: generateCow(),
          cowInventory: [],
          handleCowSelect: () => {},
          handleCowNameInputChange: () => {},
          handleCowPurchaseClick: () => {},
          handleCowSellClick: () => {},
          money: 0,
          purchasedCowPen: 1,
          selectedCowId: '',
        }}
      />
    );
  });

  describe('cow selection', () => {
    describe('cow is not selected', () => {
      test('provides correct isSelected prop', () => {
        component.setProps({
          cowInventory: [generateCow({ id: 'foo' })],
          selectedCowId: 'bar',
        });

        expect(
          component
            .find('.card-list')
            .find(CowCard)
            .props().isSelected
        ).toEqual(false);
      });
    });

    describe('cow is selected', () => {
      test('provides correct isSelected prop', () => {
        component.setProps({
          cowInventory: [generateCow({ id: 'foo' })],
          selectedCowId: 'foo',
        });

        expect(
          component
            .find('.card-list')
            .find(CowCard)
            .props().isSelected
        ).toEqual(true);
      });
    });
  });
});

describe('CowCard', () => {
  beforeEach(() => {
    component = shallow(
      <CowCard
        {...{
          cow: {
            color: cowColors.WHITE,
            name: '',
            weight: 100,
          },
          cowInventory: [],
          handleCowSelect: () => {},
          handleCowNameInputChange: () => {},
          handleCowPurchaseClick: () => {},
          isSelected: false,
          money: 0,
          purchasedCowPen: 1,
          selectedCowId: '',
        }}
      />
    );
  });

  describe('cow purchase button', () => {
    describe('player does not have enough money', () => {
      describe('cow pen has no space', () => {
        test('button is disabled', () => {
          component.setProps({
            money: 100,
          });

          expect(component.find(Button).props().disabled).toBe(true);
        });
      });

      describe('cow pen has space', () => {
        test('button is disabled', () => {
          component.setProps({
            money: 100,
          });

          expect(component.find(Button).props().disabled).toBe(true);
        });
      });
    });

    describe('player has enough money', () => {
      describe('cow pen has no space', () => {
        test('button is disabled', () => {
          const cowCapacity = PURCHASEABLE_COW_PENS.get(1).cows;
          component.setProps({
            money: 150,
            cowInventory: Array(cowCapacity)
              .fill(null)
              .map(() => generateCow()),
          });

          expect(component.find(Button).props().disabled).toBe(true);
        });
      });

      describe('cow pen has space', () => {
        test('button is not disabled', () => {
          component.setProps({
            money: 150,
          });

          expect(component.find(Button).props().disabled).toBe(false);
        });
      });
    });
  });
});

describe('CowCardSubheader', () => {
  beforeEach(() => {
    component = shallow(
      <CowCardSubheader
        {...{
          cow: {
            color: cowColors.WHITE,
            happiness: 0,
            name: '',
            weight: 100,
          },
          cowValue: 1000,
          isSellView: false,
          isPurchaseView: false,
        }}
      />
    );
  });

  describe('happiness display', () => {
    describe('is purchase view', () => {
      test('renders no hearts', () => {
        component.setProps({
          isPurchaseView: true,
        });

        expect(component.find('.heart')).toHaveLength(0);
      });
    });

    describe('is not purchase view', () => {
      test('renders hearts', () => {
        expect(component.find('.heart')).toHaveLength(10);
      });

      test('renders full hearts that match cow happiness', () => {
        expect(component.find('.heart.is-full')).toHaveLength(0);

        component.setProps({
          cow: {
            color: cowColors.WHITE,
            happiness: 0.5,
            name: '',
            weight: 100,
          },
        });

        expect(component.find('.heart.is-full')).toHaveLength(5);

        component.setProps({
          cow: {
            color: cowColors.WHITE,
            happiness: 1,
            name: '',
            weight: 100,
          },
        });

        expect(component.find('.heart.is-full')).toHaveLength(10);
      });
    });
  });
});