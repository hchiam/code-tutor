'use strict';

const { dialogflow, BasicCard, Button, Suggestions } = require('actions-on-google');
const functions = require('firebase-functions');

const app = dialogflow({ debug: true });

// so I can change the version number in just one spot (for the fulfillment inline editor anyways):
const v = 4; // also edit the intents "-1.0 No/Bye" and "1.0 Default Welcome Intent");

// make this the only global variable for the complex parsing
var codeVariables = [];

function hasScreenOutput(conv) {
  const hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
  return hasScreen;
}

app.intent('0.1 Default Fallback Intent - yes - suggestion', function suggestionPrefill(conv) {
    let suggestion = conv.contexts.get('suggest').parameters.suggestion;
    let hasScreen = hasScreenOutput(conv);

    if (hasScreen) {
      conv.ask(`Thanks! Right now, I can't open a link for you hands-free. But here's a link to a feedback form pre-filled for you:`);
    } else {
      conv.ask(`Sorry! Right now, I can't open a link for you hands-free. If you use a device with a screen, you'll see a button to go to a feedback form.`);
    }

    conv.ask(new BasicCard({
      title: `Send feedback`,
      text: `Your feedback: \n${suggestion}`,
      buttons: new Button({
        title: 'feedback form',
        url: `https://docs.google.com/forms/d/e/1FAIpQLSdi2h9SfAS2EU2AC6PjlqnKPwo5v5i3fQreFN1Vx-fs1MckEA/viewform?usp=pp_url&entry.326955045=${suggestion}`
      })
    }));
});

app.intent('3.2.1 array - size', function arraySize(conv) {
    let size = conv.contexts.get('array-size').parameters.size;

    if (typeof parseInt(size) !== 'number') {
      size = 2;
    } else if (size < 2) {
      size = 2;
    } else if (size >= 9000) {
      size = 5;
      conv.ask(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that's too O.P.! </speak>`);
      conv.ask(`Please give me a number between 2 and 5.`);
      conv.ask(new Suggestions(['2', '3', '4', '5']));
      conv.contexts.set(
        'array-size', 
        1, 
        {
          size: size
        }
      );
      return;
    } else if (size > 5) {
      size = 5;
    }

    let code = `let x = [${' ,'.repeat(size-1)} ];`;

    conv.ask(`Here's your code: \n${code}\n (an array). That's it for the code. Let's place the first item in the array x. By the way, in code, we count starting at 0. So, what should be item number 0?`);
    conv.contexts.set(
      'array-fill', 
      1, 
      {
        code: code,
        size: size,
        i: 0,
        array: []
      }
    );
});

app.intent('3.2.2 array - fill', function arrayFill(conv) {
    let code = conv.contexts.get('array-fill').parameters.code;
    let size = conv.contexts.get('array-fill').parameters.size;
    let i = conv.contexts.get('array-fill').parameters.i;
    let array = conv.contexts.get('array-fill').parameters.array;
    let value = conv.contexts.get('array-fill').parameters.value;
    let moreArrayIndicesToFill = i < size-1;

    array[i] = isNaN(value) ? `'${value}'` : value;
    code += `\nx[${i}] = ${array[i]};`;

    if (moreArrayIndicesToFill) {
      conv.ask(`Here's your code: \n${code}\n Now, what is item number ${i+1} of the list?`);
      // repeat to fill remainder of array
      conv.contexts.set(
        'array-fill',
        1, 
        {
          code: code,
          size: size,
          i: i+1,
          array: array
        }
      );
    } else {
      conv.ask(`We counted starting at 0, so we stop at ${size-1}, and not at ${size}.`);
      conv.ask(`Here's your code: \n${code}\nsay(x);\n I added a function say(x). That's it for the code. Now, say "run code" and I'll follow the instructions.`);
      conv.ask(new Suggestions(['run code', 'do something else']));
      // repeat to fill remainder of array
      conv.contexts.set(
        'array-run', 
        1, 
        {
          array: array
        }
      );
    }
});

  // // (just use this variable in the intent instead: #array-run.array)
  // function arrayRun(app) {
  //     let array = inputContexts.array;
  //     conv.ask(`Here's your code: \n${array}`);
// });

app.intent('3.4.2 loop - times', function loopTimes(conv) {
    let what = conv.contexts.get('loop-what').parameters.what;
    let times = conv.contexts.get('loop-times').parameters.times;
    if (times.toLowerCase() === 'once') times = 1;
    if (times.toLowerCase() === 'twice') times = 2;
    // extra security check
    if (isNaN(times)) {
      times = 3;
    } else if (times < 2) {
      times = 3;
    } else if (times >= 9000) {
      times = 5;
      conv.ask(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that's too O.P.!</speak>`);
      conv.ask(`Please give me a number between 2 and 5.`);
      conv.ask(new Suggestions(['2', '3', '4', '5']));
      conv.contexts.set(
        'loop-what', 
        1, 
        {
          times: times,
          what: what
        }
      );

      return;

    } else if (times > 5) {
      times = 5;
    }

    let code = `for (let i=0; i<${times}; i++) {\n    say("${what}"); \n}`;

    conv.ask(`Here's your code: \n${code}\n That's it for the code. By the way, in code, we count from 0. And because we want to repeat ${times} times, we need to stop 1 step before ${times}. Say "run code" and I'll follow the instructions.`);
    conv.ask(new Suggestions(['run code', 'do something else']));
    conv.contexts.set(
      'loop-run-code', 
      1, 
      {
        times: times,
        what: what
      }
    );
});

app.intent('3.4.3 loop - run code', function loopRun(conv) {
    // for this to work, need these contexts:
    // loop-run-code, loop-times, loop-what
    // and also these parameters:
    // times @sys.number #loop-times.times
    // what @sys.number #loop-what.what
    let times = conv.contexts.get('loop-run-code').parameters.times;
    let what = conv.contexts.get('loop-run-code').parameters.what;
    if (times.toLowerCase() === 'once') times = 1;
    if (times.toLowerCase() === 'twice') times = 2;
    // extra security check
    if (isNaN(times)) {
      times = 3;
    } else if (times < 2) {
      times = 3;
    } else if (times >= 9000) {
      times = 5;
      conv.ask(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that's too O.P.!</speak>`);
      conv.ask(`Please give me a number between 2 and 5.`);
      conv.ask(new Suggestions(['2', '3', '4', '5']));
      conv.contexts.set(
        'loop-run-code', 
        1, 
        {
          times: times,
          what: what
        }
      );

      return;

    } else if (times > 5) {
      times = 5;
    }

    let say = (what + ' ').repeat(times);
    conv.ask(say);
    conv.ask(`<speak><audio src="https://actions.google.com/sounds/v1/sports/bowling_strike.ogg"></audio>Congrats! You created a loop. You also unlocked a hidden password: "chicken nuggets". What would you like to try next? Another loop? Or a variable? Or play with sound effects?</speak>`);
    conv.ask(new Suggestions(['another loop', 'a variable', 'play with sound effects']));
});

app.intent('3.5.2 sound effects - more info', function soundEffectsMoreInfo(conv) {
    let say = "More accurately, an if statement lets your code instructions make a decision based on a value, such as what's inside a variable. \nFor example, I made this code for you: \n\n";
    let codeSay = `Let variable x equal "nothing". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
    let codeShow = `let x = "nothing";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;

    conv.ask(say + codeShow);
    conv.ask(`Let's replace the value in the variable x. What would you like to put in the variable x?`);
    conv.ask(new Suggestions(['beep', 'wood planks']));
});

app.intent('3.5.3 sound effects - value response', function soundEffectsValueResponse(conv) {
    let value = conv.contexts.get('sound-effects-value').parameters.value;
    if (value === "beep") {
      let codeSay = `Here's your code: Let variable x equal "beep". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
      let codeShow = `Here's your code: \nlet x = "beep";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
      conv.ask(codeShow +  `\n That's it for the code. Now, say "run code".`);
      conv.ask(new Suggestions(['run code', 'do something else']));
      conv.contexts.set(
        'sound-effects-beep',
        1,
        {'beep':true}
      );
    } else if (value === "wood planks") {
      let codeSay = `Here's your code: Let variable x equal "wood planks". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
      let codeShow = `Here's your code: \nlet x = "wood planks";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
      conv.ask(codeShow +  `\n That's it for the code. Now, say "run code".`);
      conv.ask(new Suggestions(['run code', 'do something else']));
      conv.contexts.set(
        'sound-effects-wood-planks',
        1,
        {'woodPlanks':true}
      );
    } else { // if value = some other value
      let codeSay = `Here's your code: Let variable x equal "${value}". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks. That's it for the code.`;
      let codeShow = `let x = "${value}";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
      conv.ask(codeShow +  `\n That's it for the code.`);
      conv.ask(`Nothing will play if you run this code. What would you like to try next? A variable? An array? A string? A loop?`); // Please say another value.`);
      conv.ask(new Suggestions(['run code', 'do something else', 'sandbox', 'a variable', 'an array', 'a string', 'a loop']));
    }
});

app.intent('3.5.3.1 sound effects - beep', function soundEffectsBeep(conv) {
    conv.add(`<speak>(beep)<audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio><audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio><audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio></speak>`);
    conv.ask('What would you like to try next? A variable? An array? A string? A loop?');
    conv.ask(new Suggestions(['a variable', 'sandbox', 'an array', 'a string', 'a loop']));
});

app.intent('3.5.3.2 sound effects - wood planks', function soundEffectsWoodPlanks(conv) {
    conv.add(`<speak>(wood planks)<audio src="https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"></audio></speak>`);
    conv.ask('What would you like to try next? A variable? An array? A string? A loop?');
    conv.ask(new Suggestions(['a variable', 'sandbox', 'an array', 'a string', 'a loop']));
});

app.intent('3.6.1 example - name', function exampleName(conv) {
    let name = conv.contexts.get('example-name').parameters.name;

    let say = `Here's your code: 
Let greeting equal "hi there". 
Let name equal "${name}". 
Let message equal greeting plus name. 
If name = "someone", then say "What's your name?". 
And then, repeating 3 times, say message.`;
    let code = `let greeting = "hi there "; 
let name = "${name}"; 
let message = greeting + name; 
if (name == "someone") 
	say("What's your name?"); 
for (let i=0; i<3; i++) 
	say(message);`;

    conv.ask(`Here's your code: ${code}`);
    conv.ask(`Say "run code" and I'll follow the instructions.`);
    conv.ask(new Suggestions(['run code', `what's a variable?`, `what's a loop?`]));
    conv.contexts.set(
      'example-run-code',
      1,
      {
        name: name
      }
    );
});

app.intent('3.6.2 example - run code', function exampleRunCode(conv) {
    let say = '';

    let greeting = "hi there ";
    let name = conv.contexts.get('example-run-code').parameters.name;
    let message = greeting + name;
    if (name === "someone") say += `What's your name? `;
    say += (message + ' ').repeat(3);

    conv.ask(say);
    conv.ask(`What would you like to try next? A variable? An array? A string? A loop?`);
    conv.ask(new Suggestions(['a variable', `what's a variable?`, 'an array', 'a string', 'a loop', 'try the example again', 'sandbox']));
});

app.intent(`3.7.0 sandbox - what's on the list`, function sandboxList(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;
    let say = '<speak> Apple equals 1. <break time="1s" /> ' + 
        'Repeat 3 times. <break time="1s" /> ' + 
        'Say hi. <break time="1s" /> ' + 
        'If banana equals fruit. <break time="1s" /> ' + 
        'Run code. <break time="1s" /> ' +
        'If you need this list again, just ask me "what\'s on the list?" </speak>';
    let optionsText = `* apple equals 1
* repeat 3 times
* say hi
* if banana equals fruit
* run code

If you need this list again, just say "what\'s on the list?"`;
    conv.ask(`Here's what you can say: \n${optionsText}`);
    conv.ask(new Suggestions(['apple equals 1', 'repeat 3 times', 'say hi', 'if banana equals fruit', 'run code']));
    conv.contexts.set(
      'sandbox',
      1,
      {
        code: removeSomePunctuation(code)
      }
    );
});

app.intent('3.7.1 sandbox - variable', function sandboxVariable(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;
    codeVariables = getVariables(code); // need to make sure variables array is up-to-date

    let variable = removeSomePunctuation(conv.contexts.get('sandbox').parameters.variable).toLowerCase();
    let value = wrapIfString(removeSomePunctuation(conv.contexts.get('sandbox').parameters.value)); // uses codeVariables

    // recognize whether variable is being reassigned
    if (codeVariables.indexOf(variable) < 0) {
      code += `let ${variable} = ${value};\n`;
      codeVariables.push(variable);
    } else {
      code += `${variable} = ${value};\n`;
    }
    conv.ask(`Here's your code:\n${code}`);
    conv.ask(`What's next?`);
    conv.ask(new Suggestions('run code'));
    conv.contexts.set(
      'sandbox',
      1,
      {
        code: code
      }
    );
});

app.intent('3.7.2 sandbox - repeat', function sandboxRepeat(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;
    codeVariables = getVariables(code); // need to make sure variables array is up-to-date

    let times = removeSomePunctuation(conv.contexts.get('sandbox').parameters.times);
    code += `for (let i=0; i<${times}; i++)\n  `;

    conv.ask(`Here's your code:\n${code}`);
    conv.ask(`What's next?`);
    conv.ask(new Suggestions('run code'));
    conv.contexts.set(
      'sandbox',
      1,
      {
        code: code
      }
    );
});

app.intent('3.7.3 sandbox - say', function sandboxSay(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;
    codeVariables = getVariables(code); // need to make sure variables array is up-to-date

    let what = wrapIfString(removeSomePunctuation(conv.contexts.get('sandbox').parameters.what));
    code += `say(${what});\n`;

    conv.ask(`Here's your code:\n${code}`);
    conv.ask(`What's next?`);
    conv.ask(new Suggestions('run code'));
    conv.contexts.set(
      'sandbox',
      1,
      {
        code: code
      }
    );
});

app.intent('3.7.4 sandbox - if', function sandboxIf(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;
    codeVariables = getVariables(code); // need to make sure variables array is up-to-date

    let variable = wrapIfString(removeSomePunctuation(conv.contexts.get('sandbox').parameters.variable));
    let value = wrapIfString(removeSomePunctuation(conv.contexts.get('sandbox').parameters.value));
    code += `if (${variable} == ${value})\n  `;

    conv.ask(`Here's your code:\n${code}`);
    conv.ask(`What's next?`);
    conv.ask(new Suggestions('run code'));
    conv.contexts.set(
      'sandbox',
      1,
      {
        code: code
      }
    );
});

app.intent('3.7.5 sandbox - run code', function sandboxRunCode(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;
    let output = '(none)';
    let haveCodeToRun = (code !== '') && (code !== undefined) && (code !== null);
    if (haveCodeToRun) {
      codeVariables = getVariables(code); // need to make sure variables array is up-to-date
      output = getOutput(code);
    }
    conv.ask(`${output}`);
    conv.ask(`What's next?`);
    if (haveCodeToRun) {
      conv.contexts.set(
        'sandbox',
        1,
        {
          code: code
        }
      );
    } else {
      conv.contexts.set(
        'sandbox',
        1,
        {
          code: '' // just in case
        }
      );
    }
});

app.intent('3.7.6 sandbox - undo', function sandboxUndo(conv) {
    let code = conv.contexts.get('sandbox').parameters.code;

    // remove last line
    code = code.split('\n');
    if (code[code.length-1] === '') code.pop();
    code.pop();
    code = code.join('\n');

    codeVariables = getVariables(code); // need to make sure variables array is up-to-date

    conv.ask(`Here's your code:\n${code}`);
    conv.ask(`What's next?`);
    conv.contexts.set(
      'sandbox',
      1,
      {
        code: code
      }
    );
});

// IMPORTANT: this "final" line must export the exact function name dialogflowFirebaseFulfillment to work:
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);

// extra helper functions needed for sandbox:

const getVariables = (codeString) => { // make sure the variables array is up-to-date

  // get variables from "let ..." lines
  let codeArray = codeString.split('\n');

  // clean slate
  codeVariables = [];

  // only get variable names from let statements in existing code
  for (let i=0; i<codeArray.length; i++) {
    let line = codeArray[i];
    if (String(line).startsWith('let ')) {
      let variableName = line.match(/let (.+?) = .+;/i)[1].toLowerCase();
      codeVariables.push(variableName);
    }
  }

  return codeVariables;
};

const wrapIfString = (value) => { // recognize if value is a variable name
  if (value.match(/.+ and .+/i)) {
    let array = value.split(' and ').map(wrapNaNWithQuotes).join(', ');
    return `[${array}]`;
  } else if (isNaN(value) && codeVariables.indexOf(value) < 0) {
    return `"${value}"`;
  } else {
    return value;
  }
};

const wrapNaNWithQuotes = (value) => {
  if (isNaN(value) && codeVariables.indexOf(value) < 0) {
    return `"${value}"`;
  } else {
    return value;
  }
};

const removeSomePunctuation = (value) => {
  return value.replace(/[.,\\\/#!$%\^&\*;:{}_`~()<>@?]/g,'');
};

// figure out the audio output based on the code
const getOutput = (code) => {

  // escape early if there's no audio output (i.e. if say() is not even used)
  if (!code.match(/.*say(.+);.*/i)) return '';

  let codeLines = code.split('\n');

  let variableValues = {}; // e.g. {a:1,b:2}

  // fill variableValues dictionary
  for (let i=0; i<codeLines.length; i++) {
    let match = codeLines[i].match(/(let )?(.+) = (.+);/i);
    if (match) {
      let variableName = match[2];
      let variableValue = match[3];
      variableValues[variableName] = variableValue;
    }
  }

  // say will be the final output
  let say = '';

  // check first line of code
  let isSaying = isSay(codeLines[0]);
  let isSetVar = isVarAssignment(codeLines[0]);
  if (isSaying) {
    say += isSaying[1] + ' ';
  } else if (isSetVar) {
    variableValues[isSetVar[2]] = isSetVar[3];
  }

  // check the rest of the lines of code
  for (let i=1; i<codeLines.length; i++) {

    let prev = codeLines[i-1];
    let curr = codeLines[i];

    let isAfterIf = isIf(prev);
    let isAfterFor = isFor(prev);

    isSaying = isSay(curr);
    isSetVar = isVarAssignment(curr);

    if ((isAfterIf && isAfterIf[1] === isAfterIf[2]) || (!isAfterIf && !isAfterFor && !isSetVar)) {

      if (isSaying) {
        let variableName = isSaying[1];
        if (codeVariables.includes(variableName)) {
          say += variableValues[variableName] + ' ';
        } else {
          say += isSaying[1] + ' ';
        }
      }

    } else if (isAfterFor) {

      let times = parseInt(isAfterFor[2]) - parseInt(isAfterFor[1]);
      if (times === undefined || times > 5 || times < 1) {
        times = 5;
      }
      if (isSaying) {
        let variableName = isSaying[1];
        if (codeVariables.includes(variableName)) {
          say += (variableValues[variableName] + ' ').repeat(times);
        } else {
          say += (isSaying[1] + ' ').repeat(times);
        }
      }

    } else if (isSetVar) {

      let variableName = isSetVar[2];
      let variableValue = isSetVar[3];//if (codeVariables.includes(variableName)) {
      let isLeftVar = codeVariables.includes(variableName);
      let isRightVar = codeVariables.includes(variableValue);

      if (!isRightVar) {
        variableValues[variableName] = variableValue;
      } else {
        variableValues[variableName] = variableValues[variableValue];
      }

    }

  }

  return say;
};

const isSay = (line) => { // returns the whole match object
  return line.match(/say[(]"?(.+?)"?[)]/i); // /say[(](.+?)[)]/i // /say[(]"?(.+?)"?[)]/i
};

const isIf = (line) => { // returns the whole match object
  return line.match(/if [(](.+?) == (.+?)[)]/i);
};

const isFor = (line) => { // returns the whole match object
  return line.match(/for [(]let i=(.+?); i<(.+?); i\+\+[)]/i);
};

const isVarAssignment = (line) => { // returns the whole match object
  return line.match(/(let )?(.+?) = (.+?);/i);
};
