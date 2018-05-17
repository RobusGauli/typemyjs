# TYPE MY JS

A type enforcer for javascript.

```javascript
import Types, { wrapWithType } from 'typemyjs'

const AreaType = {
  length: Types.NumberType({
      range: [0, 100]
      }),
  width: Types.NumberType(),
  calculateArea: Types.FunctionType({
    requiredAttributes: {
      length: a => a,
      width: a => a,
      }})
}

class Area {
  constructor(length, breadth) {
    this.length = length;
    this.breadth = breadth;
  }
  calculateArea() {
    return this.length * this.breadth;
  }
}

Area = wrapWithType(AreaType)(Area);

// voila
```




## Documentation coming sooon.

## Under Development

