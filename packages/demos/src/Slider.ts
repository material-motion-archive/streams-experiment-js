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

import isolate from '@cycle/isolate';
import { DOMSource } from '@cycle/dom/rxjs-typings';
import { Stream } from 'xstream';
import { VNode } from '@cycle/dom';
import { html } from 'snabbdom-jsx';

export type Sources = {
  DOM: DOMSource,
  props: Stream<{
    label: string,
    initialValue: number,
    units: string,
    min: number,
    max: number,
    decimals: number,
  }>,
}

export type Sinks = {
  DOM: Stream<VNode>,
  value: Stream<number>,
}

export default function(sources: Sources) {
  return isolate(Slider)(sources);
}

function Slider({ DOM, props: props$ }: Sources):any {
  const value$ = DOM.select('input').events('input').map(
    event => event.target.value
  );

  const state$ = props$.map(
    props => value$.startWith(props.initialValue).map(
      value => (
        {
          label: props.label,
          units: props.units,
          min: props.min,
          max: props.max,
          value: parseFloat(value),
        }
      )
    )
  ).flatten().remember();

  return {
    DOM: state$.map(
      ({ label, units, props, min, max, value }) => (
        <div
          style = {
            {
              display: 'flex',
              flexDirection: 'column',
              marginBottom: '16px',
            }
          }
        >
          <div
            style = {
              {
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                fontSize: '20px',
              }
            }
          >
            <label>
              { label }
            </label>

            <div
              style = {
                {
                  display: 'inline-flex',
                  flexDirection: 'row',
                }
              }
            >
              { value }{ units }
            </div>
          </div>

          <input
            type = 'range'
            min = { min }
            max = { max }
            value = { value }
          />
        </div>
      )
    ),

    value: state$.pluck({ key: 'value' }),
  };
}
