const express = require('express');
const ApiAiAssistant = require('actions-on-google').ApiAiAssistant;
const bodyParser = require('body-parser');
const request = require('request');
const Map = require('es6-map');
const prettyjson = require('prettyjson');

const app = express();

app.use(bodyParser.json({type: 'application/json'}));

app.use(express.static('public'));

app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.post('/', function(req, res, next) {
  // debug
  logObject('Request headers: ', req.headers);
  logObject('Request body: ', req.body);
    
  const assistant = new ApiAiAssistant({request: req, response: res});
  
  // The action name from the API.AI (i.e. DialogFlow) intent
  const ACTION = req.body.result.action;
  // const PARAMETER = 'number'; // An API.ai parameter name

  // Create functions to handle intents here
  function handleIntent(assistantObject) {
    console.log('Handling action: ' + ACTION);
    
    // extracting my custom code here
    myCustomCode(ACTION, assistantObject);
  }
  
  // Add handler functions to the action router.
  let actionRouter = new Map();
  actionRouter.set(ACTION, handleIntent); // the ACTION should map to the respective intent method
  
  // Route requests to the proper handler functions via the action router.
  assistant.handleRequest(actionRouter);
});

// Handle errors.
app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

// Pretty print objects for logging.
function logObject(message, object, options) {
  console.log(message);
  console.log(prettyjson.render(object, options));
}

// Listen for requests.
let server = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + server.address().port);
});

/*------------------------------------------*/

// my custom code
function myCustomCode(action, assistant) {
  let contextData = assistant.data.contextOut;
  // assistant.data stores the data for use in the rest of the conversation, but you can still ask questions at each step
  if (action === 'test-run') {
    // let i = contextData.input;
    // let o = contextData.output;
    // contextData.result = 'true';
    
    // this one works
    let i = assistant.getArgument('input');
    let o = assistant.getArgument('output');
    assistant.ask('Expected input: ' + i + '. Expected output: ' + o + '.\ntest multiline --- works on a real device');
    
    // assistant.tell(assistant.buildRichResponse().addBasicCard(assistant.buildBasicCard("card text")));
    // assistant.ask(assistant.buildRichResponse().addBasicCard(assistant.buildBasicCard("card text")));
    
    // assistant.ask(assistant.buildRichResponse()
    //     .addSimpleResponse("Simple response")
    //     .addBasicCard(assistant.buildBasicCard('L1 L2 L3')
    // ));
    
  } else {
    assistant.ask('The action is ' + action);
  }
}
