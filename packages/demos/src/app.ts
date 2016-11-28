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

import pairwise from 'xstream/extra/pairwise'
import sampleCombine from 'xstream/extra/sampleCombine'

import { DOMSource } from '@cycle/dom/rxjs-typings';
import { VNode } from '@cycle/dom';
import { html } from 'snabbdom-jsx';

import {
  Stream,
  Listener,
} from 'xstream'

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
      spring.setCurrentValue(currentValue, !isAtRest);
    }

    if (endValue !== undefined) {
      spring.setEndValue(endValue);
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

export function App(sources: Sources): Sinks {
  const dragY$ = getDrag$FromDOMSource(
    sources.DOM.select('.draggable')
  ).pluck({ key: 'y' });

  const circlePositionY = 0;
  const squarePositionY = 300;
  let destinationY = squarePositionY;

  // should springs be in App or in a driver? ¯\_(ツ)_/¯
  const springY$ = spring({
    speed: 50,
    bounciness: 3,
    initialValue: squarePositionY,
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
  ).startWith(
    squarePositionY

  // TODO: there should be different thresholds for circle->square and
  // square->circle
  //
  // how would you visualize that in a tool?
  ).threshold({
    breakpoint: squarePositionY - 96,
    forward() {
      springCornerRadius$.update({ endValue: 0 });
      destinationY = squarePositionY;
    },
    backward() {
      springCornerRadius$.update({ endValue: 1 });
      destinationY = circlePositionY;
    }
  });

  combinedDragY$Proxy.imitate(
    dragY$.compose(
      sampleCombine(locationY$)
    ).map(
      ([dragY, locationY]) => dragY + locationY
    )
  );

  // TODO: trigger an explicit state here (e.g. `circle`) and let the rest of
  // the app react to it.  tap then becomes state: otherState and can reuse the
  // same logic
  sources.DOM.select('.draggable').events('pointerup').compose(
    sampleCombine(locationY$)
  ).subscribe({
    next([, y) {
      springY$.update({ currentValue: y, endValue: destinationY });
    }
  });

  const vtree$ = Stream.combine(
    locationY$,
    springCornerRadius$,
  ).map(
    ([y, cornerRadius]) => (
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
    )
  );

  const sinks = {
    DOM: vtree$
  };

  return sinks;
}
