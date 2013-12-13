/*
 * Requires:
 *     psiturk.js
 *     utils.js
 */

// Initalize psiturk object
var psiTurk = PsiTurk();

// All pages to be loaded
var pages = [
	"instruct.html",
	"test.html",
	"postquestionnaire.html"
];

psiTurk.preloadPages(pages);



// Stimuli for a basic bandit experiment RAND INTS AND ASSIGN TO CARDS?
var data = {};


// Task object to keep track of the current phase
var currentview;


/********************
* HTML manipulation
*
* All HTML files in the templates directory are requested 
* from the server when the PsiTurk object is created above. We
* need code to get those pages from the PsiTurk object and 
* insert them into the document.
*
********************/


/*************************
* INSTRUCTIONS         
*************************/

var Instructions = function(pages) {
	var currentscreen = 0,
	    timestamp;
	    instruction_pages = pages; 
	
	var next = function() {
		psiTurk.showPage(instruction_pages[currentscreen]);
		$('.continue').click(function() {
			buttonPress();
		});
		
		currentscreen = currentscreen + 1;

		// Record the time that an instructions page is presented
		timestamp = new Date().getTime();
	};

	var buttonPress = function() {

		// Record the response time
		var rt = (new Date().getTime()) - timestamp;
		psiTurk.recordTrialData(["INSTRUCTIONS", currentscreen, rt]);

		if (currentscreen == instruction_pages.length) {
			finish();
		} else {
			next();
		}

	};

	var finish = function() {
		// Record that the user has finished the instructions and 
		// moved on to the experiment. This changes their status code
		// in the database.
		//psiTurk.finishInstructions();

		// Move on to the experiment 
		currentview = new TestPhase();
	};

	next();
};



/********************
* BANDIT TEST       *
********************/

var TestPhase = function () {
    // Globals
    var cardSelected = false;
    var hiddenTime = 1000;
    var trialDelay = 2500;
    var trial = 1;

    // Work around for testing
    var trialType = 2;

    // Function to generate numbers, stored in data
    var genNumbers = function() {
        data = {};
        data['card1'] = Math.floor(Math.random()*11);
        data['card2'] = Math.floor(Math.random()*11);
        data['card3'] = Math.floor(Math.random()*11);
        data['card4'] = Math.floor(Math.random()*11);
        return data;
    };

    // Generate data
    data = genNumbers();

    // Function to set cards
    var setCards = function(data) {
        $('#1').html(data['card1']);
        $('#2').html(data['card2']);
        $('#3').html(data['card3']);
        $('#4').html(data['card4']);
    };

    // Initialise cards
    setCards(data);


    var next = function() {
        if (trial == 4) {
            finish();
        }
        else {
            // First thing, hide all cards
            $('._card p').hide();

            // When a card is selected
            $('._card').click(function () {
                // Get value of selection and refresh
                if (cardSelected == false) {
                    cardSelected = true;

                    // Show card picked
                    var card = $(this).find('p', 'first');
                    card.slideDown();


                    // Condition 3: (show card picked) followed by all remaining, hidden cards
                    if (trialType == 3) {
                        $('._card :hidden').delay(hiddenTime).slideDown();
                    }

                    // Update trial number
                    trial++;

                    // Create and assign new card values
                    setTimeout(function () {
                        data = genNumbers();
                        data['card_chosen'] = card.attr('id');
                        data['trialType'] = trialType;
                        data['max'] = Math.max(data['card1'], data['card2'], data['card3'], data['card4'])

                        setCards(data);

                        // For testing- iterate through data and print to console
                        for (var x in data) {
                            console.log(x, data[x])
                        }
                        console.log(trial);

                        // Condition 1: unnecessary to code, (show card picked)
                        // Condition 2: (show card picked) and max alternative
                        if (trialType == 2) {
                            $('ul.list-unstyled li').html('The maximum from the last trial was ' + data['max']);
                        }

                        // Re-hide all new cards
                        $('._card p').hide();

                        cardSelected = false;

                    }, trialDelay);
                }
            });

        }
    };

    var finish = function() {
		currentview = new Questionnaire();
	};

    // Load the test.html snippet into the body of the page
	psiTurk.showPage('test.html');

    // Start the test
	next();

};


/****************
* Questionnaire *
****************/

var Questionnaire = function() {

	var error_message = "<h1>Oops!</h1><p>Something went wrong submitting your HIT. This might happen if you lose your internet connection. Press the button to resubmit.</p><button id='resubmit'>Resubmit</button>";

	record_responses = function() {

		psiTurk.recordTrialData(['postquestionnaire', 'submit']);

		$('textarea').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
		});
		$('select').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);		
		});

	};
	
	finish = function() {
		debriefing();
	};
	
	prompt_resubmit = function() {
		replaceBody(error_message);
		$("#resubmit").click(resubmit);
	};

	resubmit = function() {
		replaceBody("<h1>Trying to resubmit...</h1>");
		reprompt = setTimeout(prompt_resubmit, 10000);
		
		psiTurk.saveData({
			success: function() {
				clearInterval(reprompt); 
				finish();
			}, 
			error: prompt_resubmit}
		);
	};

	// Load the questionnaire snippet 
	psiTurk.showPage('postquestionnaire.html');
	psiTurk.recordTrialData(['postquestionnaire', 'begin']);
	
	$("#continue").click(function () {
		record_responses();
		psiTurk.teardownTask();
    	psiTurk.saveData({success: finish, error: prompt_resubmit});
	});
	
};


var debriefing = function() { window.location="/debrief?uniqueId=" + psiTurk.taskdata.id; };


/*******************
 * Run Task
 ******************/
$(window).load( function(){
    currentview = new Instructions([
		"instruct.html"
	]);
});

// vi: noexpandtab tabstop=4 shiftwidth=4
