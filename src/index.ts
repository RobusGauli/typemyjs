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
// tslint:disable-next-line:typedef
function FunctionType(validationObject: { readonly [key: string]: any }) {
  return validationObject;
}

function NumberType(validationObject: any) {
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
          // there is a error
          const payload = generatedErrors.reduce((acc: any, key: any) => {
            return errorPayload[key][1] === OUT_OF_RANGE
              ? { ...acc, [OUT_OF_RANGE]: validationObject.range }
              : { ...acc, [errorPayload[key][1]]: null };
          }, {});
          return {
            error: true,
            payload
          };
        } else {
          return {
            error: false
          };
        }
      }
    }();
  };
}

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

        const errorPayload: { readonly [key: string]: boolean } = {
          isInRange,
          isOneOf
        };
        if (
          Object.keys(errorPayload).filter(key => errorPayload[key] === false)
            .length >= 1
        ) {
          // there is a error
          const payload = {
            error: true,
            errorPayload
          };
          if (!isOneOf) {
            return {
              ...payload,
              validStringTypes: validationObject.oneOf
            };
          }
          return payload;
        } else {
          return {
            error: false,
            errorPayload
          };
        }
      }
    }();
  };
}

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
  let error: boolean = false;
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

function requiredFunctionParameters(
  validationObject: any,
  requiredArgumentList: ReadonlyArray<any>,
  requiredAttributes: ReadonlyArray<any>
) {
  return function(func: any) {
    return function(argumentObject: any) {
      const target = this;
      if (
        !(typeof argumentObject === 'object') ||
        `${argumentObject}` === 'null'
      ) {
        throw new Error(
          'Must pass a valid object to the constructor function.'
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
      return {
        error: false,
        result: func.bind(target)(argumentObject)
      };
    };
  };
}

export function wrapWithType(validationObject: any) {
  return function(classObject: any) {
    // make the new prototype
    const methodsOnClass = Object.getOwnPropertyNames(classObject.prototype);
    const propsOnValidationObject = Object.keys(validationObject);
    methodsOnClass.forEach(method => {
      // if the method exists on validation Object
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
      // we have a validation object and the actual argument object passed to the object construction
      const v = validateObjectConstruction(args, validationObject);
      if (v.error) {
        throw v;
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
