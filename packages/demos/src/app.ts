/** @license
 *  Copyright 2016 - present The Material Motion Authors. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not
 *  use this file except in compliance with the License. You may obtain a copy
 *  of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 *  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 *  License for the specific language governing permissions and limitations
 *  under the License.
 */

import 'material-motion-streams-experiment';

import dropRepeats from 'xstream/extra/dropRepeats'
import pairwise from 'xstream/extra/pairwise'
import sampleCombine from 'xstream/extra/sampleCombine'

import { DOMSource } from '@cycle/dom/rxjs-typings';
import { VNode } from '@cycle/dom';
import { html } from 'snabbdom-jsx';

import Slider from './Slider';

import {
  Stream,
  Listener,
} from 'xstream';

import {
  SpringConfig,
  SpringSystem,
} from 'rebound';

export type Sources = {
  DOM: DOMSource
}

export type Sinks = {
  DOM: Stream<VNode>
}

function getPointerLocationFromEvent(event: PointerEvent) {
  return {
    x: event.pageX,
    y: event.pageY,
  };
}

function getDistanceBetweenPoints([prev, next]) {
  if (!prev || !next) {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x: next.x - prev.x,
    y: next.y - prev.y,
  };
}

function addPoints([prev, next]) {
  if (!prev || !next) {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x: next.x + prev.x,
    y: next.y + prev.y,
  };
}

// TODO: make this abstract to work for any { translate, rotate, scale }
function getDrag$FromDOMSource(domSource) {
  return domSource.events('pointerdown').map(
    downEvent => {
      downEvent.target.setPointerCapture(downEvent.pointerId);

      return domSource.events('pointermove').endWhen(
        domSource.events('pointerup').take()
      ).startWith(
        downEvent
      ).map(
        getPointerLocationFromEvent
      ).compose(pairwise).map(
        getDistanceBetweenPoints
      )
    }
  ).flatten();
}

const springSystem = new SpringSystem();
export function spring({ bounciness, speed, initialValue = 0 }) {
  let lastConfig = { bounciness, speed };

  const spring = springSystem.createSpringWithBouncinessAndSpeed(bounciness, speed);

  const result = Stream.create({
    start(listener: Listener<any>) {

      spring.setCurrentValue(initialValue);
      listener.next(initialValue);

      spring.addListener({
        onSpringUpdate() {
          listener.next(spring.getCurrentValue());
        }
      });
    },

    stop() {
      spring.destroy();
    },
  });

  result.update = function({ currentValue, endValue, isAtRest = false, bounciness, speed }) {
    if (currentValue !== undefined) {
      spring.setCurrentValue(currentValue);
    }

    if (endValue !== undefined) {
      spring.setEndValue(endValue);
    }

    if (isAtRest) {
      spring.setAtRest();
    }

    let updateConfig = false;

    if (bounciness !== undefined) {
      lastConfig.bounciness = bounciness;
      updateConfig = true;
    }

    if (speed !== undefined) {
      lastConfig.speed = speed;
      updateConfig = true;
    }

    if (updateConfig) {
      spring.setSpringConfig(
        SpringConfig.fromBouncinessAndSpeed(bounciness, speed)
      );
    }
  };

  return result;
}

export function App({ DOM }: Sources): Sinks {
  const dragY$ = getDrag$FromDOMSource(
    DOM.select('.draggable')
  ).pluck({ key: 'y' });

  const {
    DOM: breakpointSliderDOM$,
    value: breakpoint$,
  } = Slider({
    DOM,
    props: Stream.of({
      label: 'Breakpoint',
      initialValue: 96,
      units: 'dp',
      min: 0,
      max: 300,
      decimals: 0,
    })
  });

  const initialPosition = 300;

  const {
    DOM: squarePositionSliderDOM$,
    value: squarePosition$,
  } = Slider({
    DOM,
    props: Stream.of({
      label: 'Square position',
      initialValue: initialPosition,
      units: 'dp',
      min: 0,
      max: 900,
      decimals: 0,
    })
  });

  // should springs be in App or in a driver? ¯\_(ツ)_/¯
  const springY$ = spring({
    speed: 50,
    bounciness: 3,
    // if springs accepted streams as input, initialValue would be squarePosition$
    initialValue: initialPosition,
  })

  const springCornerRadius$ = spring({
    speed: 50,
    bounciness: 3,
    initialValue: 0,
  });

  // drags are relative to the last known location, but location$ doesn't exist
  // yet, so we define it in terms of a proxy that will be filled later with a
  // stream of (drag + last location).
  //
  // Proxying drag instead of location, because proxy.imitate doesn't work with
  // memory streams like startWith
  const combinedDragY$Proxy = Stream.create();

  const locationY$ = Stream.merge(
    springY$,
    combinedDragY$Proxy,
    squarePosition$,
  ).startWith(
    initialPosition
  );

  combinedDragY$Proxy.imitate(
    dragY$.compose(
      sampleCombine(locationY$)
    ).map(
      ([dragY, locationY]) => dragY + locationY
    )
  );

  // If you're within `breakpoint` of an end, you are in that state.  If you no
  // longer are, show a preview of the other state, and transition to it on
  // release.
  //
  // Possible states:
  // - A
  // - A /w B preview
  // - B
  // - B /w A preview
  //
  // TODO: provide an abstraction like "threshold" to handle these state
  // transitions with symmetric breakpoints
  //
  // The following is not the most efficient way to model that, but it's a way.

  const isCircle$ = Stream.combine(locationY$, breakpoint$).map(
    ([locationY, breakpoint]) => locationY < breakpoint
  ).compose(dropRepeats()).remember();

  const isSquare$ = Stream.combine(locationY$, breakpoint$, squarePosition$).map(
    ([locationY, breakpoint, squarePosition]) => locationY > (squarePosition - breakpoint)
  ).compose(dropRepeats()).remember();

  // there appears to be a bug where prev and next are always equal, so wasCircle + !isSquare doesn't trigger
  const showCircle$ = Stream.combine(
    isCircle$,
    isSquare$
  ).map(
    // `combine` recycles the same instance for every emission, so cache each
    // value in its own array to enable comparisons in pairwise
    (pair) => [...pair]
  ).compose(pairwise).map(
    ([prev, next]) => {
      const [isCircle, isSquare] = next;
      const [wasCircle, wasSquare] = prev;

      if (isCircle) {
        return true;
      } else if (isSquare) {
        return false;
      } else if (wasCircle) {
        return false;
      } else {
        return true;
      }
    }
  );

  showCircle$.subscribe({
    next(showCircle) {
      springCornerRadius$.update({
        endValue: showCircle
          ? 1
          : 0
      })
    },
  });

  DOM.select('.draggable').events('pointerdown').subscribe({
    next() {
      springY$.update({ isAtRest: true })
    }
  });

  DOM.select('.draggable').events('pointerup').compose(
    sampleCombine(locationY$, squarePosition$, showCircle$)
  ).subscribe({
    next([event, locationY, squarePosition, showCircle]) {
      springY$.update({
        currentValue: locationY,
        endValue: showCircle
          ? 0
          : squarePosition,
      });
    }
  });

  const vtree$ = Stream.combine(
    locationY$,
    springCornerRadius$,
    squarePositionSliderDOM$,
    breakpointSliderDOM$,
  ).map(
    ([
      y,
      cornerRadius,
      squarePositionSliderDOM,
      breakpointSliderDOM
    ]) => (
      <div
        style = {
          {
            display: 'flex',
            flexDirection: 'row',
          }
        }
      >
        <div
          className = 'draggable'
          attrs = {
            {
              'touch-action': 'none'
            }
          }
          style = {
            {
              touchAction: 'none',
              backgroundColor: '#8BC34A',
              position: 'relative',
              width: '300px',
              height: '300px',
              borderRadius: (50 * cornerRadius).toFixed() + '%',
              boxShadow: `
                0 3px 1px -2px rgba(0, 0, 0, 0.2),
                0 2px 2px 0 rgba(0, 0, 0, 0.14),
                0 1px 5px 0 rgba(0, 0, 0, 0.12)
              `,
              willChange: 'transform',
              transform: `translateY(${ y }px)`,
            }
          }
        />
        <div
          style = {
            {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              flex: 1,
            }
          }
        >
          { squarePositionSliderDOM }
          { breakpointSliderDOM }
        </div>
      </div>
    )
  );

  return {
    DOM: vtree$
  };
}
