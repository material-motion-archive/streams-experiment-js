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

// To quickly prototype our operators, we're monkeypatching Stream with them.
//
// Eventually, we'll want to make MaterialStream its own independent thing
// (hiding operators we don't support).  There are plenty of Observable
// implementations we should delegate to, to save the work of implementing them
// ourselves.  most.create looks small and fast.  Hopefully in a few years,
// we'll just use browser-native Observables.
//
// Perhaps the final implementation looks something like this:
//
// class MaterialStream<T> implements Observable<T> {
//   constructor(parentStream:Observable<T>)

import {
  Stream,
  MemoryStream,
  Listener,
} from 'xstream';

Stream.prototype.cap = MemoryStream.prototype.cap = makeSimpleOperator(
  function (next, { min, max, resistance = 0 }) {
    let result = next;
    let overshoot = 0;

    if (result < min) {
      result = min;
      overshoot = (min - next);
    } else if (result > max) {
      result = max;
      overshoot = (next - max);
    }

    // TODO: rubber band physics probably needs more sophistication, e.g. overshoot * (1 / resistance) ** overshoot
    if (resistance && overshoot) {
      overshoot = overshoot / resistance;

      if (result === min) {
        result = result - overshoot;
      } else {
        result = result + overshoot;
      }
    }

    return result;
  }
);

Stream.prototype.pluck = MemoryStream.prototype.pluck = makeSimpleOperator(
  function (next, { key }) {
    return next[key];
  }
);

Stream.prototype.shift = MemoryStream.prototype.shift = makeSimpleOperator(
  function (next, { offset, subtract = false }) {
    const coefficient = subtract
      ? -1
      : 1;

    return next + coefficient * offset;
  }
);

Stream.prototype.scale = MemoryStream.prototype.scale = makeSimpleOperator(
  function (next, { coefficient }) {
    return next * coefficient;
  }
);

Stream.prototype.invertNormalized = MemoryStream.prototype.invertNormalized = makeSimpleOperator(
  function (next) {
    return 1 - next;
  }
);

Stream.prototype.threshold = MemoryStream.prototype.threshold = makeSimpleOperator(
  function (next, { breakpoint, forward, backward }) {
    if (forward && next > breakpoint && this.lastTriggered !== 'forward') {
      forward();
      this.lastTriggered = 'forward';

    } else if (backward && next < breakpoint && this.lastTriggered !== 'backward') {
      backward();
      this.lastTriggered = 'backward';
    }

    return next;
  }
);

function makeSimpleOperator(operator) {
  return function (this: Stream<any>, operatorConfig = {}) {
    // Give the operator a context to store state in
    operator = operator.bind({});
    const parentStream = this;

    let prev;
    let dispatch;
    let subscription;
    let configSubscriptions = {};
    let lastValue;
    let lastConfig = {};

    const stream = Stream.create({
      start(listener:Listener<any>) {
        dispatch = () => {
          try {
            listener.next(
              operator(lastValue, lastConfig)
            );
          } catch (error) {
            listener.error(error);
          }
        };

        subscription = parentStream.subscribe(
          {
            next(value:any) {
              lastValue = value;
              dispatch();
            },

            complete() {
              listener.complete();
            },

            error(error: Error) {
              listener.error(error);
            },
          }
        );

        Object.entries(operatorConfig).forEach(
          ([key, valueOrStream]) => {
            if (valueOrStream.subscribe) {
              configSubscriptions[key] = valueOrStream.subscribe(
                value => {
                  lastConfig[key] = value;
                  dispatch();
                }
              );
            } else {
              lastConfig[key] = valueOrStream;
            }
          }
        );
      },

      stop() {
        Object.values(configSubscriptions).forEach(
          configSubscription => configSubscription.unsubscribe()
        );

        subscription.unsubscribe();
      },
    });

    return stream;
  }
}
