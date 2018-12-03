// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// make this the only global variable for the complex parsing
var codeVariables = [];

function hasScreenOutput(request) {
    if (request !== undefined) {
        let requestPayload = request.body.originalDetectIntentRequest.payload;
        if (requestPayload.surface && requestPayload.surface.capabilities && requestPayload.surface.capabilities[0]) {
            for (let i=0; i<requestPayload.surface.capabilities.length; i++) {
                if (requestPayload.surface.capabilities[i].name == 'actions.capability.SCREEN_OUTPUT') {
                    return true;
                }
            }
        }
    }
    return false;
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    // Note: "action-name" !== "intent name" (example: action 'input.unknown' is for intent '0.0 Default Fallback Intent')
    // https://dialogflow.com/docs/actions-and-parameters
    // https://dialogflow.com/docs/contexts
    // https://dialogflow.com/docs/reference/v1-v2-migration-guide-fulfillment#webhook_request
    const parameters = request.body.queryResult.parameters; // example: {"size":3}
    // inputContexts acts like app.getContext('array-fill').parameters
    const inputContexts = request.body.queryResult.outputContexts[0].parameters; // example: {"size.original":"3","size":3}
    const requestSource = (request.body.originalDetectIntentRequest) ? request.body.originalDetectIntentRequest.source : undefined; // example: "google"
    
    // create app so you can do app.add(...);
    const app = new WebhookClient({ request, response });

    // so I can change the version number in just one spot (for the fulfillment inline editor anyways):
    const v = 4; // also edit the intents "-1.0 No/Bye" and "1.0 Default Welcome Intent"

    function suggestionPrefill(app) {
        let suggestion = parameters.suggestion;
        let hasScreen = hasScreenOutput(request);

        if (hasScreen) {
            app.add(`Thanks! Right now, I can't open a link for you hands-free. But here's a link to a feedback form pre-filled for you:`);
        } else {
            app.add(`Sorry! Right now, I can't open a link for you hands-free. If you use a device with a screen, you'll see a button to go to a feedback form.`);
        }

        app.add(new Card({
            title: `Send feedback`,
            imageUrl: ``,
            text: `Your feedback: \n${suggestion}`,
            buttonText: `feedback form`,
            buttonUrl: `https://docs.google.com/forms/d/e/1FAIpQLSdi2h9SfAS2EU2AC6PjlqnKPwo5v5i3fQreFN1Vx-fs1MckEA/viewform?usp=pp_url&entry.326955045=${suggestion}`
        }));
    }

    function arraySize(app) {
        let size = parameters.size;
        
        if (typeof parseInt(size) !== 'number') {
            size = 2;
        } else if (size < 2) {
            size = 2;
        } else if (size >= 9000) {
            size = 5;
            app.add(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that's too O.P.!</speak>`);
            app.add(`Please give me a number between 2 and 5.`)
            app.setContext({
                name: 'array-size', 
                lifespan: 1, 
                parameters: {
                    size: size
                }
            });
            return;
        } else if (size > 5) {
            size = 5;
        }
        
        let code = `let x = [${' ,'.repeat(size-1)} ];`;
        
        app.add(`Here's your code: \n${code}\nLet's place the first item in the array x. By the way, in code, we count starting at 0. So, what should be item number 0?`);
        app.setContext({
            name: 'array-fill', 
            lifespan: 1, 
            parameters: {
                code: code,
                size: size,
                i: 0,
                array: []
            }
        });
    }

    function arrayFill(app) {
        let code = inputContexts.code;
        let size = inputContexts.size;
        let i = inputContexts.i;
        let array = inputContexts.array;
        let value = parameters.value;
        let moreArrayIndicesToFill = i < size-1;
        
        array[i] = isNaN(value) ? `'${value}'` : value;
        code += `\nx[${i}] = ${array[i]};`;
        
        if (moreArrayIndicesToFill) {
            app.add(`Here's your code: \n${code}\n Now, what is item number ${i+1} of the list?`);
            // repeat to fill remainder of array
            app.setContext({
                name: 'array-fill', 
                lifespan: 1, 
                parameters: {
                    code: code,
                    size: size,
                    i: i+1,
                    array: array
                }
            });
        } else {
            app.add(`We counted starting at 0, so we stop at ${size-1}, and not at ${size}.`);
            app.add(`Here's your code: \n${code}\nsay(x);\n I added a function say(x). That's it for the code. Now, say "run code" and I'll follow the instructions.`);
            app.add(new Suggestion('run code'));
            app.add(new Suggestion('do something else'));
            // repeat to fill remainder of array
            app.setContext({
                name: 'array-run', 
                lifespan: 1, 
                parameters: {
                    array: array
                }
            });
        }
    }

    // // (just use this variable in the intent instead: #array-run.array)
    // function arrayRun(app) {
    //     let array = inputContexts.array;
    //     app.add(`Here's your code: \n${array}`);
    // }

    function loopTimes(app) {
        let what = inputContexts.what;
        let times = inputContexts.times;
        if (times.toLowerCase() === 'once') times = 1;
        if (times.toLowerCase() === 'twice') times = 2;
        // extra security check
        if (isNaN(times)) {
            times = 3;
        } else if (times < 2) {
            times = 3;
        } else if (times >= 9000) {
            times = 5;
            app.add(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that's too O.P.!</speak>`);
            app.add(`Please give me a number between 2 and 5.`)
            app.setContext({
                name: 'loop-what', 
                lifespan: 1, 
                parameters: {
                    times: times,
                    what: what
                }
            });

            return;

        } else if (times > 5) {
            times = 5;
        }
        
        let code = `for (let i=0; i<${times}; i++) {\n    say("${what}"); \n}`;
        
        app.add(`Here's your code: \n${code}\n That's it for the code. By the way, in code, we count from 0. And because we want to repeat ${times} times, we need to stop 1 step before ${times}. Say "run code" and I'll follow the instructions.`);
        app.add(new Suggestion('run code'));
        app.add(new Suggestion('do something else'));
        app.setContext({
            name: 'loop-run', 
            lifespan: 1, 
            parameters: {
                times: times,
                what: what
            }
        });
    }

    function loopRun(app) {
        // for this to work, need these contexts:
            // loop-run-code, loop-times, loop-what
        // and also these parameters:
            // times @sys.number #loop-times.times
            // what @sys.number #loop-what.what
        let times = inputContexts.times;
        let what = inputContexts.what;
        if (times.toLowerCase() === 'once') times = 1;
        if (times.toLowerCase() === 'twice') times = 2;
        // extra security check
        if (isNaN(times)) {
            times = 3;
        } else if (times < 2) {
            times = 3;
        } else if (times >= 9000) {
            times = 5;
            app.add(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that's too O.P.!</speak>`);
            app.add(`Please give me a number between 2 and 5.`)
            app.setContext({
                name: 'loop-run', 
                lifespan: 1, 
                parameters: {
                    times: times,
                    what: what
                }
            });

            return

        } else if (times > 5) {
            times = 5;
        }
        
        let say = (what + ' ').repeat(times);
        app.add(say);
        app.add(`<speak><audio src="https://actions.google.com/sounds/v1/sports/bowling_strike.ogg"></audio>Congrats! You created a loop. You also unlocked a hidden password: "chicken nuggets". What would you like to try next? Another loop? Or a variable? Or play with sound effects?</speak>`);
        
        app.add(new Suggestion('another loop'));
        app.add(new Suggestion('a variable'));
        app.add(new Suggestion('play with sound effects'));
    }

    function soundEffectsMoreInfo (app) {
        let say = "More accurately, an if statement lets your code instructions make a decision based on a value, \
            such as what's inside a variable. \nFor example, I made this code for you: \n\n"
        let codeSay = `Let variable x equal "nothing". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
        let codeShow = `let x = "nothing";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;

        app.add(say + codeShow);
        app.add(`What would you like to put in the variable x?`);
    }

    function soundEffectsValueResponse(app) {
        let value = inputContexts.value;
        if (value === "beep") {
            let codeSay = `Here's your code: Let variable x equal "beep". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
            let codeShow = `Here's your code: \nlet x = "beep";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
            app.add(codeShow +  `\n That's it for the code. Now, say "run code".`)
            app.add(new Suggestion('run code'));
            app.add(new Suggestion('do something else'));
            app.setContext({
                name: 'sound-effects-beep',
                lifespan: 1,
                parameters: {}
            });
        } else if (value === "wood planks") {
            let codeSay = `Here's your code: Let variable x equal "wood planks". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
            let codeShow = `Here's your code: \nlet x = "wood planks";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
            app.add(codeShow +  `\n That's it for the code. Now, say "run code".`)
            app.add(new Suggestion('run code'));
            app.add(new Suggestion('do something else'));
            app.setContext({
                name: 'sound-effects-wood-planks',
                lifespan: 1,
                parameters: {}
            });
        } else { // if value = some other value
            let codeSay = `Here's your code: Let variable x equal "${value}". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks. That's it for the code.`;
            let codeShow = `let x = "${value}";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
            app.add(codeShow +  `\n That's it for the code. Now, say "run code".`)
            app.add(`Nothing will play if you run this code. What would you like to try next? A variable? An array? A string? A loop?`); // Please say another value.`);
            app.add(new Suggestion('run code'));
            app.add(new Suggestion('do something else'));
            app.add(new Suggestion('sandbox'));
            app.add(new Suggestion('a variable'));
            app.add(new Suggestion('an array'));
            app.add(new Suggestion('a string'));
            app.add(new Suggestion('a loop'));
            app.setContext({
                name: 'sound-effects-wood-planks',
                lifespan: 1,
                parameters: {}
            });
            // // not working right now:
            // app.setContext('sound-effects-value-response', 1, {
            //   value: value
            // });
        }
    }

    function soundEffectsBeep(app) {
        let say =  '<speak>\
            <audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>\
            <audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>\
            <audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>\
            </speak>';
        let displayText = '(beep)';
        app.add(say);
        app.add('What would you like to try next? A variable? An array? A string? A loop?');
        app.add(new Suggestion('a variable'));
        app.add(new Suggestion('sandbox'));
        app.add(new Suggestion('an array'));
        app.add(new Suggestion('a string'));
        app.add(new Suggestion('a loop'));
    }

    function soundEffectsWoodPlanks(app) {
        let say =  `<speak><audio src="https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"></audio></speak>`;
        let displayText = '(wood planks)';
        app.add(say);
        app.add('What would you like to try next? A variable? An array? A string? A loop?');
        app.add(new Suggestion('a variable'));
        app.add(new Suggestion('sandbox'));
        app.add(new Suggestion('an array'));
        app.add(new Suggestion('a string'));
        app.add(new Suggestion('a loop'));
    }

    function exampleName(app) {
        let name = inputContexts.name;
    
        let say = 'Here\'s your code: \
            Let greeting equal "hi there". \
            Let name equal "' + name + '". \
            Let message equal greeting plus name. \
            If name = "someone", then say "What\'s your name?". \
            And then, repeating 3 times, say message.';
        let code = 'let greeting = "hi there ";\
            \nlet name = "' + name + '";\
            \nlet message = greeting + name;\
            \nif (name == "someone")\
            \n\tsay("What\'s your name?");\
            \nfor (let i=0; i<3; i++)\
            \n\tsay(message);';
    
        app.add(code);
        app.add(`Say "run code" and I'll follow the instructions.`);
        app.add(new Suggestion('run code'));
        app.add(new Suggestion(`what's a variable?`));
        app.add(new Suggestion(`what's a loop?`));
        app.setContext({
            name: 'example-run-code',
            lifespan: 1,
            parameters: {
                name: name
            }
        });
    }

    function exampleRunCode(app) {
        let say = '';
    
        let greeting = "hi there ";
        let name = inputContexts.name;
        let message = greeting + name;
        if (name === "someone") say += `What's your name? `;
        say += (message + ' ').repeat(3);
    
        app.add(say);
        app.add(`What would you like to try next? A variable? An array? A string? A loop?`);
        app.add(new Suggestion('a variable'));
        app.add(new Suggestion(`what's a variable?`));
        app.add(new Suggestion('an array'));
        app.add(new Suggestion('a string'));
        app.add(new Suggestion('a loop'));
        app.add(new Suggestion('try the example again'));
        app.add(new Suggestion('sandbox'));
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set('0.1 Default Fallback Intent - yes - suggestion', suggestionPrefill);
    intentMap.set('3.2.1 array - size', arraySize);
    intentMap.set('3.2.2 array - fill', arrayFill);
    intentMap.set('3.4.2 loop - times', loopTimes);
    intentMap.set('3.4.3 loop - run code', loopRun);
    intentMap.set('3.5.2 sound effects - more info', soundEffectsMoreInfo);
    intentMap.set('3.5.3 sound effects - value response', soundEffectsValueResponse);
    intentMap.set('3.5.3.1 sound effects - beep', soundEffectsBeep);
    intentMap.set('3.5.3.2 sound effects - wood planks', soundEffectsWoodPlanks);
    intentMap.set('3.6.1 example - name', exampleName);
    intentMap.set('3.6.2 example - run code', exampleRunCode);
    app.handleRequest(intentMap);

    //     'sandbox-list': () => {
    //         let code = inputContexts.code;
    //         let say = '<speak> Apple equals 1. <break time="1s" /> ' + 
    //             'Repeat 3 times. <break time="1s" /> ' + 
    //             'Say hi. <break time="1s" /> ' + 
    //             'If banana equals fruit. <break time="1s" /> ' + 
    //             'Run code. <break time="1s" /> ' +
    //             'If you need this list again, just ask me "what\'s on the list?" </speak>';
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse("Here's what you can say:")
    //             .addSimpleResponse({
    //                 speech: say,
    //                 displayText: '* apple equals 1\n\
    //                     * repeat 3 times\n\
    //                     * say hi\n\
    //                     * if banana equals fruit\n\
    //                     * run code\n\n\
    //                     If you need this list again, just say "what\'s on the list?"'
    //             })
    //         app.setContext('sandbox', 1, {
    //             code: removeSomePunctuation(code)
    //         });
    //         app.add(googleResponse);
    //     },

    //     'sandbox-variable': () => {
    //         let code = inputContexts.code;
    //         codeVariables = getVariables(code); // need to make sure variables array is up-to-date
        
    //         let variable = removeSomePunctuation(inputContexts.variable).toLowerCase();
    //         let value = wrapIfString(removeSomePunctuation(inputContexts.value)); // uses codeVariables
        
    //         // recognize whether variable is being reassigned
    //         if (codeVariables.indexOf(variable) < 0) {
    //             code += `let ${variable} = ${value};\n`;
    //             codeVariables.push(variable);
    //         } else {
    //             code += `${variable} = ${value};\n`;
    //         }
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse(`Here's your code:\n${code}`)
    //             .addSimpleResponse(`What's next?`)
    //         app.setContext('sandbox', 1, {
    //             code: code
    //         });
    //         app.add(googleResponse);
    //     },

    //     'sandbox-repeat': () => {
    //         let code = inputContexts.code;
    //         codeVariables = getVariables(code); // need to make sure variables array is up-to-date
        
    //         let times = removeSomePunctuation(inputContexts.times);
    //         code += `for (let i=0; i<${times}; i++)\n  `;
        
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse(`Here's your code:\n${code}`)
    //             .addSimpleResponse(`What's next?`)
    //         app.setContext('sandbox', 1, {
    //             code: code
    //         });
    //         app.add(googleResponse);
    //     },

    //     'sandbox-say': () => {
    //         let code = inputContexts.code;
    //         codeVariables = getVariables(code); // need to make sure variables array is up-to-date
        
    //         let what = wrapIfString(removeSomePunctuation(inputContexts.what));
    //         code += `say(${what});\n`;
        
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse(`Here's your code:\n${code}`)
    //             .addSimpleResponse(`What's next?`)
    //         app.setContext('sandbox', 1, {
    //             code: code
    //         });
    //         app.add(googleResponse);
    //     },

    //     'sandbox-if': () => {
    //         let code = inputContexts.code;
    //         codeVariables = getVariables(code); // need to make sure variables array is up-to-date
        
    //         let variable = wrapIfString(removeSomePunctuation(inputContexts.variable));
    //         let value = wrapIfString(removeSomePunctuation(inputContexts.value));
    //         code += `if (${variable} == ${value})\n  `;
        
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse(`Here's your code:\n${code}`)
    //             .addSimpleResponse(`What's next?`)
    //         app.setContext('sandbox', 1, {
    //             code: code
    //         });
    //         app.add(googleResponse);
    //     },

    //     'sandbox-run-code': () => {
    //         let code = inputContexts.code;
    //         codeVariables = getVariables(code); // need to make sure variables array is up-to-date
        
    //         let output = getOutput(code);
        
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse(`${output}`)
    //             .addSimpleResponse(`What's next?`)
    //         app.setContext('sandbox', 1, {
    //             code: code
    //         });
    //         app.add(googleResponse);
    //     },

    //     'sandbox-undo': () => {
    //         let code = inputContexts.code;
        
    //         // remove last line
    //         code = code.split('\n');
    //         if (code[code.length-1] === '') code.pop();
    //         code.pop();
    //         code = code.join('\n');
        
    //         codeVariables = getVariables(code); // need to make sure variables array is up-to-date
        
    //         let googleResponse = app.buildRichResponse()
    //             .addSimpleResponse(`Here's your code:\n${code}`)
    //             .addSimpleResponse(`What's next?`)
    //         app.setContext('sandbox', 1, {
    //             code: code
    //         });
    //         app.add(googleResponse);
    //     },
    // };
});

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
}

const wrapIfString = (value) => { // recognize if value is a variable name
    if (value.match(/.+ and .+/i)) {
        let array = value.split(' and ').map(wrapNaNWithQuotes).join(', ');
        return `[${array}]`;
    } else if (isNaN(value) && codeVariables.indexOf(value) < 0) {
        return `"${value}"`;
    } else {
        return value;
    }
}

const wrapNaNWithQuotes = (value) => {
    if (isNaN(value) && codeVariables.indexOf(value) < 0) {
        return `"${value}"`;
    } else {
        return value;
    }
}

const removeSomePunctuation = (value) => {
    return value.replace(/[.,\\\/#!$%\^&\*;:{}_`~()<>@?]/g,'');
}

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
}

const isSay = (line) => { // returns the whole match object
    return line.match(/say[(]"?(.+?)"?[)]/i); // /say[(](.+?)[)]/i // /say[(]"?(.+?)"?[)]/i
}

const isIf = (line) => { // returns the whole match object
    return line.match(/if [(](.+?) == (.+?)[)]/i);
}

const isFor = (line) => { // returns the whole match object
    return line.match(/for [(]let i=(.+?); i<(.+?); i\+\+[)]/i);
}

const isVarAssignment = (line) => { // returns the whole match object
    return line.match(/(let )?(.+?) = (.+?);/i)
}
