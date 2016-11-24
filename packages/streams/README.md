# Material Motion Streams (experiment)

This is an exploration into reactively implementing the [Material Motion architecture](https://material-motion.github.io/material-motion/starmap/).

Though it is maintained by a core member of the Material Motion team, it is **not an official Material Motion project**. _Use at your own risk._

As [Ryan Florence](https://github.com/ryanflorence/) once said:

> "THIS IS EXPERIMENTAL SO IF YOU USE IT & FIND PROBLEMS THEY ARE YOUR PROBLEMS THAT YOU MUST SOLVE, MAYBE EVEN ALL BY YOURSELF."

## Motivation

The Material Motion architecture aims to coordinate all motion in an application through [one interface](https://material-motion.github.io/material-motion/starmap/specifications/runtime/MotionRuntime/), so visual tooling can inspect and modify it.

If we can express [motion primitives](https://material-motion.github.io/material-motion/starmap/specifications/primitives/) like springs, gestures, and timelines as purely declarative operators on streams, we can build tools to represent them as compositions, like the timeline in a video editor.  This will make them easier to work with: edit, or maybe create, even for someone with no programming experience.

### Example operators:

- cap({ min, max, resistance })
- pluck
- interpolate({ from, to })
- shift({ offset })
- scale({ coefficient })
- invert
- debounce
- distinct
- threshold: measure if the incoming stream is >, >=, <, or <= a particular threshold; useful for mapping pointerStream.pointers.length to isAtRest or triggering an animation
- to/from polar coords

## Q + A

### Will this ever be folded into the official [material-motion repo](https://github.com/material-motion/material-motion-js/)?

```
¯\_(ツ)_/¯
```

Though the ideas explored here may inform the [development of](https://material-motion.github.io/material-motion/starmap/) the [official project](https://github.com/material-motion/material-motion-js/), this project is just as likely to be abandoned.  Don't rely on its existence.  It is unsupported.

## Inspiration ##

- [Jafar Hussain](https://github.com/jhusain/)'s [talks on reactive programming](https://www.youtube.com/watch?v=lil4YCCXRYc)
- [CycleJS](https://cycle.js.org)'s model of [the user as a function](https://www.youtube.com/watch?v=1zj7M1LnJV4)
- Animation tools like [Flash](https://en.wikipedia.org/wiki/Adobe_Flash) and [non-linear editing timelines](https://en.wikipedia.org/wiki/Non-linear_editing_system)

## License ##

[Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0)

