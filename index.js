'use strict';

const functions = require('firebase-functions');
const DialogflowApp = require('actions-on-google').DialogflowApp;

// make this the only global variable for the complex parsing
var codeVariables = [];

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log('Request headers: ' + JSON.stringify(request.headers));
    console.log('Request body: ' + JSON.stringify(request.body));
    
    // Note: "action-name" !== "intent name"
    // https://dialogflow.com/docs/actions-and-parameters
    // https://dialogflow.com/docs/contexts
    let action = request.body.result.action;
    const parameters = request.body.result.parameters;
    const inputContexts = request.body.result.contexts[0].parameters; // debug without [0].parameters and JSON.stringify to see more info in a JSON
    const requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
    
    // create app so you can do app.ask(...);
    const app = new DialogflowApp({
        request: request,
        response: response
    });
    
    // so I can change the version number in just one spot (for the fulfillment inline editor anyways):
    const v = 2; // also edit the intent -1.0 No/Bye
    
    const actionHandlers = {
        'default': () => {
            // https://developers.google.com/actions/assistant/responses
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: "Sorry, I didn't understand that.",
                    displayText: "Sorry. \nI didn't understand that."
                })
            app.ask(googleResponse);
        },
        
        'input.unknown': () => {
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse("I'm still learning. Would you like to suggest something for me to work on to teach you next time?")
                .addSuggestionLink('feedback form', 'https://goo.gl/forms/mn2Xcy0tmNyFQ5y72')
            app.ask(googleResponse);
        },
        
        'suggestion-prefill': () => {
            let suggestion = parameters.suggestion;
            let hasScreen = app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);
            let googleResponse;
            if (hasScreen) {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`Thanks. Right now Google's Dialogflow isn't able to let me open a link for you hands-free. But here's a link to a feedback form that I've pre-filled for you with what I just heard: ${suggestion}`)
                    .addSuggestionLink('feedback form', `https://docs.google.com/forms/d/e/1FAIpQLSdi2h9SfAS2EU2AC6PjlqnKPwo5v5i3fQreFN1Vx-fs1MckEA/viewform?usp=pp_url&entry.326955045=${suggestion}`)
                app.ask(googleResponse);
            } else {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`Sorry, right now Google's Dialogflow isn't able to let me open a link for you hands-free. If you use a device with a screen, you'll see a button to go to a feedback form. Code Tutor version ${v} signing out.`)
                // exit by using tell instead of say
                app.tell(googleResponse);
            }
        },
        
        'array-size': () => {
            let size = parameters.size;
            
            if (typeof parseInt(size) !== 'number') {
                size = 2;
            } else if (size < 2) {
                size = 2;
            } else if (size >= 9000) {
                size = 2;
                app.tell(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that was too O.P.; Code Tutor version ${v} signing out.</speak>`);
            } else if (size > 5) {
                size = 5;
            }
            
            let code = `let x = [${' ,'.repeat(size-1)} ];`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Let's place the first item in the array x. By the way, in code, we count starting at 0. So, what should be item number 0?`)
                .addSimpleResponse({
                  speech: '',
                  displayText: code
                })
            
            app.setContext('array-fill', 1, {
                code: code,
                size: size,
                i: 0,
                array: []
            });
            
            app.ask(googleResponse);
        },
        
        'array-fill': () => {
            let code = inputContexts.code;
            let size = inputContexts.size;
            let i = inputContexts.i;
            let array = inputContexts.array;
            let value = parameters.value;
            let googleResponse;
            let moreArrayIndicesToFill = i < size-1;
            
            array[i] = value;
            code += `\nx[${i}] = ${value};`;
            
            if (moreArrayIndicesToFill) {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`And what is item number ${i+1} of the list?`)
                    .addSimpleResponse({
                      speech: '',
                      displayText: code
                    })
                // repeat to fill remainder of array
                app.setContext('array-fill', 1, {
                    code: code,
                    size: size,
                    i: i+1,
                    array: array
                });
            } else {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse(`We counted starting at 0, so we stop at ${size-1}, and not at ${size}.`)
                    .addSimpleResponse({
                        speech: `Here's your code: ${code}. I added a function say(x). That's it for the code. Now, say "run code" and I'll follow the instructions.`,
                        displayText: `Here's your code: \n${code} \nsay(x);`
                    })
                    .addSuggestions(['run code', 'do something else']);
                app.setContext('array-run', 1, {
                    array: array
                });
            }
            app.ask(googleResponse);
        },
        
        // // (just show in intent instead: #array-run.array)
        // 'array-run': () => {
        //     let array = inputContexts.array;
        //     let googleResponse = app.buildRichResponse()
        //         .addSimpleResponse(`Here's your array: ${array}`)
        //     app.ask(googleResponse);
        // },
        
        'loop-times': () => {
            let what = inputContexts.what;
            let times = inputContexts.times;
            if (typeof parseInt(times) !== 'number') {
                times = 3;
            } else if (times < 1) {
                times = 3;
            } else if (times >= 9000) {
                times = 2;
                app.tell(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that was too O.P.; Code Tutor version ${v} signing out.</speak>`);
            } else if (times > 5) {
                times = 5;
            }
            
            let code = `for (let i=0; i<${times}; i++) {\n    say("${what}"); \n}`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse("Here's your code:")
                .addSimpleResponse({
                  speech: `${code}. That's it for the code. By the way, in code, we count from 0. And because we want to repeat ${times} times, we need to stop 1 step before ${times}. Say "run code" and I'll follow the instructions.`,
                  displayText: code
                })
                .addSuggestions(['run code', 'do something else'])
            
            app.setContext('loop-run', 1, {
                times: times,
                what: what,
            });
            
            app.ask(googleResponse);
        },
        
        'loop-run': () => {
            // for this to work, need these contexts:
                // loop-run-code, loop-times, loop-what
            // and also these parameters:
                // times @sys.number #loop-times.times
                // what @sys.number #loop-what.what
            let times = inputContexts.times;
            let what = inputContexts.what;
            
            // extra security check
            if (typeof parseInt(times) !== 'number') {
                times = 3;
            } else if (times < 1) {
                times = 3;
            } else if (times >= 9000) {
                times = 2;
                app.tell(`<speak><audio src="https://actions.google.com/sounds/v1/impacts/crash.ogg"></audio>Sorry, that was too O.P.; Code Tutor version ${v} signing out.</speak>`);
            } else if (times > 5) {
                times = 5;
            }
            
            let say = (what + ' ').repeat(times);
            
            let congrats = `<speak><audio src="https://actions.google.com/sounds/v1/sports/bowling_strike.ogg"></audio>Congrats! You created a loop. You also unlocked a hidden password: "chicken nuggets". What would you like to try next? Another loop? Or a variable? Or play with sound effects?</speak>`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(say)
                .addSimpleResponse({
                    speech: congrats,
                    displayText: `Congrats! You created a loop. You also unlocked a hidden password: "chicken nuggets". What would you like to try next? `
                })
                .addSuggestions(['another loop', 'a variable', 'play with sound effects'])
            
            app.ask(googleResponse);
        },
        
        'sound-effects-more-info': () => {
            let say = "More accurately, an if statement lets your code instructions make a decision based on a value, \
                such as what's inside a variable. \nFor example, I made this code for you: \n\n"
            let codeSay = `Let variable x equal "nothing". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks.`;
            let codeShow = `let x = "nothing";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: say + codeSay,
                    displayText: say + codeShow
                })
                .addSimpleResponse(`What would you like to put in the variable x?`)
            
            app.ask(googleResponse);
        },
        
        'sound-effects-value-response': () => {
            let value = inputContexts.value;
            let googleResponse;
            
            if (value === "beep") {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse({
                        speech: `Here's your code: Let variable x equal "beep". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks. That's it for the code.`,
                        displayText: `Here's your code: \nlet x = "beep";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`
                    })
                    .addSimpleResponse(`Now, say "run code".`)
                    .addSuggestions(['run code', 'do something else'])
                app.setContext('sound-effects-beep');
            } else if (value === "wood planks") {
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse({
                        speech: `Here's your code: Let variable x equal "wood planks". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks. That's it for the code.`,
                        displayText: `Here's your code: \nlet x = "wood planks";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`
                    })
                    .addSimpleResponse(`Now, say "run code".`)
                    .addSuggestions(['run code', 'do something else'])
                app.setContext('sound-effects-wood-planks');
            } else { // if value = some other value
                googleResponse = app.buildRichResponse()
                    .addSimpleResponse({
                        speech: `Here's your code: Let variable x equal "${value}". If x = "beep", then play a beep, otherwise if x = "wood planks", then play wood planks. That's it for the code.`,
                        displayText: `let x = "${value}";\nif (x == "beep") {\n\tplayBeep();\n} else if (x == "wood planks") {\n\tplayWoodPlanks();\n}`
                    })
                    .addSimpleResponse({
                        speech: `Nothing will play if you run this code. What would you like to try next? A variable? An array? A string? A loop?`,// Please say another value.`,
                        displayText: `Nothing will play if you run this code. What would you like to try next?`// Please say another value.`
                    })
                    .addSuggestions(['do something else', 'sandbox', 'a variable', 'an array', 'a string', 'a loop'])
                // // not working right now:
                // app.setContext('sound-effects-value-response', 1, {
                //   value: value
                // });
            }
            app.ask(googleResponse);
        },
        
        'sound-effects-beep': () => {
            let say =  '<speak>\
                <audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>\
                <audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>\
                <audio src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>\
                </speak>';
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: say,
                    displayText: '(beep)'
                })
                .addSimpleResponse({
                    speech: 'What would you like to try next? A variable? An array? A string? A loop?',
                    displayText: 'What would you like to try next?'
                })
                .addSuggestions(['a variable', 'sandbox', 'an array', 'a string', 'a loop'])
            
            app.ask(googleResponse);
        },
        
        'sound-effects-wood-planks': () => {
            let say =  `<speak><audio src="https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"></audio></speak>`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: say,
                    displayText: '(wood planks)'
                })
                .addSimpleResponse({
                    speech: 'What would you like to try next? A variable? An array? A string? A loop?',
                    displayText: 'What would you like to try next?'
                })
                .addSuggestions(['a variable', 'sandbox', 'an array', 'a string', 'a loop'])
            
            app.ask(googleResponse);
        },
        
        'example-name': () => {
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
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse({
                    speech: say,
                    displayText: code
                })
                .addSimpleResponse(`Say "run code" and I'll follow the instructions.`)
                .addSuggestions(['run code', `what's a variable?`, `what's a loop?`]);
            
            app.setContext('example-run-code', 1, {
                name: name
            });
            
            app.ask(googleResponse);
        },
        
        'example-run-code': () => {
            let say = '';
            
            let greeting = "hi there ";
            let name = inputContexts.name;
            let message = greeting + name;
            if (name === "someone") say += `What's your name? `;
            say += (message + ' ').repeat(3);
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(say)
                .addSimpleResponse({
                    speech: `What would you like to try next? A variable? An array? A string? A loop?`,
                    displayText: 'What would you like to try next?'
                })
                .addSuggestions(['a variable', `what's a variable?`, 'an array', 'a string', 'a loop', 'try the example again', 'sandbox'])
            
            app.ask(googleResponse);
        },
        
        'sandbox-list': () => {
            let code = inputContexts.code;
            let say = '<speak> Apple equals 1. <break time="1s" /> ' + 
                'Repeat 3 times. <break time="1s" /> ' + 
                'Say hi. <break time="1s" /> ' + 
                'If banana equals fruit. <break time="1s" /> ' + 
                'Run code. <break time="1s" /> ' +
                'If you need this list again, just ask me "what\'s on the list?" </speak>';
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse("Here's what you can say:")
                .addSimpleResponse({
                    speech: say,
                    displayText: '* apple equals 1\n\
                        * repeat 3 times\n\
                        * say hi\n\
                        * if banana equals fruit\n\
                        * run code\n\n\
                        If you need this list again, just say "what\'s on the list?"'
                })
            app.setContext('sandbox', 1, {
                code: removeSomePunctuation(code)
            });
            app.ask(googleResponse);
        },
        
        'sandbox-variable': () => {
            let code = inputContexts.code;
            codeVariables = getVariables(code); // need to make sure variables array is up-to-date
            
            let variable = removeSomePunctuation(inputContexts.variable).toLowerCase();
            let value = wrapIfString(removeSomePunctuation(inputContexts.value)); // uses codeVariables
            
            // recognize whether variable is being reassigned
            if (codeVariables.indexOf(variable) < 0) {
                code += `let ${variable} = ${value};\n`;
                codeVariables.push(variable);
            } else {
                code += `${variable} = ${value};\n`;
            }
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Here's your code:\n\n${code}`)
                .addSimpleResponse(`What's next?`)
            app.setContext('sandbox', 1, {
                code: code
            });
            app.ask(googleResponse);
        },
        
        'sandbox-repeat': () => {
            let code = inputContexts.code;
            codeVariables = getVariables(code); // need to make sure variables array is up-to-date
            
            let times = removeSomePunctuation(inputContexts.times);
            code += `for (let i=0; i<${times}; i++)\n  `;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Here's your code:\n\n${code}`)
                .addSimpleResponse(`What's next?`)
            app.setContext('sandbox', 1, {
                code: code
            });
            app.ask(googleResponse);
        },
        
        'sandbox-say': () => {
            let code = inputContexts.code;
            codeVariables = getVariables(code); // need to make sure variables array is up-to-date
            
            let what = wrapIfString(removeSomePunctuation(inputContexts.what));
            code += `say(${what});\n`;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Here's your code:\n\n${code}`)
                .addSimpleResponse(`What's next?`)
            app.setContext('sandbox', 1, {
                code: code
            });
            app.ask(googleResponse);
        },
        
        'sandbox-if': () => {
            let code = inputContexts.code;
            codeVariables = getVariables(code); // need to make sure variables array is up-to-date
            
            let variable = wrapIfString(removeSomePunctuation(inputContexts.variable));
            let value = wrapIfString(removeSomePunctuation(inputContexts.value));
            code += `if (${variable} == ${value})\n  `;
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Here's your code:\n\n${code}`)
                .addSimpleResponse(`What's next?`)
            app.setContext('sandbox', 1, {
                code: code
            });
            app.ask(googleResponse);
        },
        
        'sandbox-run-code': () => {
            let code = inputContexts.code;
            codeVariables = getVariables(code); // need to make sure variables array is up-to-date
            
            let output = getOutput(code);
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`${output}`)
                .addSimpleResponse(`What's next?`)
            app.setContext('sandbox', 1, {
                code: code
            });
            app.ask(googleResponse);
        },
        
        'sandbox-undo': () => {
            let code = inputContexts.code;
            
            // remove last line
            code = code.split('\n');
            if (code[code.length-1] === '') code.pop();
            code.pop();
            code = code.join('\n');
            
            codeVariables = getVariables(code); // need to make sure variables array is up-to-date
            
            let googleResponse = app.buildRichResponse()
                .addSimpleResponse(`Here's your code:\n\n${code}`)
                .addSimpleResponse(`What's next?`)
            app.setContext('sandbox', 1, {
                code: code
            });
            app.ask(googleResponse);
        },
    };
    
    if (!actionHandlers[action]) {
        action = 'default';
    }
    
    actionHandlers[action]();
    
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
