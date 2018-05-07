/**
 * Error codes
 */
const NULL_OR_UNDEFINED = 100;
const NAN = 200;
const OUT_OF_RANGE = 300;
const MISMATCH_PARAMETERS = 400;
const UNDEFINED_OR_NULL_ATTRIBUTES = 500;

/**
 * Signature function that simply returns. Just for api consistency.
 * @param {object} validationObject
 *
 * @returns {object}
 */
function FunctionType(validationObject: { readonly [key: string]: any }) {
  return validationObject;
}

/**
 * Signature function for defining number type .
 * 
 * # Example (es imports)
 * import Types from 'type';
 * const validator = {
 *  length: Types.NumberType({
 *    range: [1, 100]
 *  })
 * }
 * 
 * @param {object} validationObject 
 * 
 * @returns {function} 
 */
function NumberType(validationObject: any = {}) {
  return function(value: any) {
    return new class {
      public validate() {
        const isNumber = typeof value === 'number';
        if (!isNumber || value === 'undfined' || value === null) {
          return {
            error: true,
            payload: {
              [NULL_OR_UNDEFINED]: null
            }
          };
        }
        const isNotNan = !(Number(value).toString() === 'NaN');
        const isInRange = validationObject.range
          ? value >= validationObject.range[0] &&
            value < validationObject.range[1]
          : true;

        const errorPayload: { readonly [key: string]: [boolean, number] } = {
          isNotNan: [isNotNan, NAN],
          isNumber: [isNumber, NULL_OR_UNDEFINED],
          isInRange: [isInRange, OUT_OF_RANGE]
        };
        const generatedErrors = Object.keys(errorPayload).filter(
          key => errorPayload[key][0] === false
        );

        if (generatedErrors.length) {
          const payload = generatedErrors.reduce((acc: any, key: any) => {
            return errorPayload[key][1] === OUT_OF_RANGE
              ? { ...acc, [OUT_OF_RANGE]: validationObject.range }
              : { ...acc, [errorPayload[key][1]]: null };
          }, {});

          return {
            payload,
            error: true
          };
        }

        return {
          error: false
        };
        
      }
    }();
  };
}

/**
 * Signature function for defining String type .
 * 
 * # Example (es imports)
 * import Types from 'type';
 * const validator = {
 *  color: Types.StringType({
 *    oneOf: ['RED', 'GREEN']
 *  })
 * }
 * 
 * @param {object} validationObject 
 * 
 * @returns {function} 
 */
function StringType(validationObject: any) {
  
  return function(value: any) {
    return new class {
      public validate() {
        const isInRange = validationObject.minLength
          ? value.length >= validationObject.minLength
          : true;
        const isOneOf =
          validationObject.oneOf && Array.isArray(validationObject.oneOf)
            ? validationObject.oneOf.indexOf(value) !== -1
            : true;

        const payload: { readonly [key: string]: boolean } = {
          isInRange,
          isOneOf
        };
        if (
          Object.keys(payload).filter(key => payload[key] === false)
            .length >= 1
        ) {
          const errorPayload = {
            payload,
            error: true
          };
          if (!isOneOf) {
            return {
              ...errorPayload,
              validStringTypes: validationObject.oneOf
            };
          }

          return payload;
        }

        return {
          payload,
          error: false
        };
      
      }
    }();
  };
}

/**
 * Functions that throws and error if argument passed to the constructor is mismatched from the intented argument.
 * 
 * @param {object} constructorArgument 
 * @param {object} validationObject 
 */
function validateObjectConstruction(
  constructorArgument: any,
  validationObject: any
) {
  if (
    !(typeof constructorArgument === 'object') ||
    `${constructorArgument}` === 'null'
  ) {
    throw new Error('Must pass a valid object to the constructor function.');
  }

  // check for the required parameters that needs to passed for the object construction
  if (
    validationObject.__constructorParameters &&
    Array.isArray(validationObject.__constructorParameters)
  ) {
    const constructorActualParameters = Object.keys(constructorArgument);
    const paramDiff = validationObject.__constructorParameters.filter(
      (param: any) => constructorActualParameters.indexOf(param) === -1
    );
    if (paramDiff.length) {
      throw new Error(
        `Mismatch constructor argument. Expected ${validationObject.__constructorParameters.join(
          ', '
        )} but only got ${constructorActualParameters.join(', ')}.`
      );
    }
  }
  const args = Object.keys(constructorArgument);
  const errorPayload: { [key: string]: {} } = {};
  let error = false;
  args.forEach(arg => {
    if (validationObject[arg]) {
      const result = validationObject[arg](constructorArgument[arg]).validate();
      if (result.error === true) {
        error = true;
        errorPayload[arg] = result;
      }
    }
  });

  return {
    error,
    errorPayload
  };
}

/**
 * Wrapper function that wraps around the method of the class 
 * to enforce the type.
 * 
 * @param {object} validationObject 
 * @param {Array} requiredArgumentList 
 * @param {Array} requiredAttributes 
 * 
 * @returns {Function}
 */
function requiredFunctionParameters(
  validationObject: any,
  requiredArgumentList: ReadonlyArray<any>,
  requiredAttributes: ReadonlyArray<any>
) {
  return function(func: any) {
    return function(argumentObject: any) {
      const target = this;
      if (
        requiredArgumentList &&
        Array.isArray(requiredArgumentList)
      ) {
        if (
          !(typeof argumentObject === 'object') ||
          `${argumentObject}` === 'null'
        ) {
          throw new Error(
            'Must pass a valid object to the function.'
          );
        }
        const parametersDiff = requiredArgumentList.filter(
          arg => Object.keys(argumentObject).indexOf(arg) === -1
        );
        if (parametersDiff.length >= 1) {

          return {
            error: true,
            errorPayload: {
              code: MISMATCH_PARAMETERS,
              data: parametersDiff,
              message: 'Parameters missing.'
            }
          };
        }
      }
      if (
        typeof requiredAttributes === 'object' &&
        Object.keys(requiredAttributes).length
      ) {
        const payload: { [key: string]: any } = {
          error: false,
          code: UNDEFINED_OR_NULL_ATTRIBUTES,
          errorPayload: {}
        };
  
        Object.keys(requiredAttributes).forEach((attribute: any) => {
          const accessor = requiredAttributes[attribute];
          let val;
          if (typeof accessor === 'function') {
            val = accessor(target[attribute]);
          } else {
            val = target[attribute];
          }
          const validator = validationObject[attribute];
          const result = validator(val).validate();
  
          if (result.error) {
            payload.error = true;
            payload.errorPayload[attribute] = result;
          }
        });
        if (payload.error) {
          return {
            ...payload
          };
        }
      }
      
      return {
        error: false,
        result: func.bind(target)(argumentObject)
      };
    };
  };
}

/**
 * Wrapper Function around the client/user class
 * # Example
 *  class Area {
 *    constructor(arg) {
 *      this.length = arg.length;
 *      this.breadth = arg.breadth; 
 *    }
 *    
 *    calculateArea() {
 *      return this.length * this.breadth;
 *    }
 *  } 
 * 
 *  import { wrapWithType }, Types from 'type';
 * 
 *  const typeProtocol = {
 *    length: Types.NumberType({
 *      range: [1, 100]
 *    }),
 *    breadth: Types.NumberType(),
 *    calculateArea: Types.FunctionType({
 *      requiredAttributes: {
 *        length: (k: any) => k,
 *        breadth: (k: any) => k
 *      }
 *    })
 *  }
 * 
 *  Area = wrapWithType(validtionObject)(Area);
 *  #
 * @param {object} validationObject 
 * @returns {Function}
 */
export function wrapWithType(validationObject: any) {
  return function(classObject: any) {
    // make the new prototype by wrapping around user defined class methods
    const methodsOnClass = Object.getOwnPropertyNames(classObject.prototype);
    const propsOnValidationObject = Object.keys(validationObject);
    methodsOnClass.forEach(method => {
      // if the method exists on validation Object, then wrap around the prototype method
      if (propsOnValidationObject.indexOf(method) !== -1) {
        const requiredList = validationObject[method].requiredParams;
        const requiredAttributes = validationObject[method].requiredAttributes;
        classObject.prototype[method] = requiredFunctionParameters(
          validationObject,
          requiredList,
          requiredAttributes
        )(classObject.prototype[method]);
      }
    });

    return function(args: any) {
      if (
        (validationObject.__constructorParameters &&
        Array.isArray(validationObject.__constructorParameters)) ||
        Object.keys(args).length
      ) {
          const v = validateObjectConstruction(args, validationObject);
          if (v.error) {
            throw v;
          }
        }
      const target = new classObject(args);

      return target;
    };
  };
}

export default {
  FunctionType,
  StringType,
  NumberType
};
