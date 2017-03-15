<?php

session_start();

// loads same local member cache as the RFID door access system:
// https://github.com/dtbaker/techspace-door-php
require_once '/opt/php-door/inc.php';

$result = array();
$result['messages'] = array();


header('Content-type: text/json');

$rfid = $_REQUEST['rfid'];
$callback = isset($_REQUEST['callback']) ? $_REQUEST['callback'] : false;
$answer = isset($_REQUEST['answer']) ? $_REQUEST['answer'] : false;
$visit_times = array(
	'Quick visit',
	'An hour',
	'A few hours',
	'Not sure',
);
$how_long_question = array(
	'type' => 'question',
	'text' => 'How long are you going to be here today?',
	'answers' => $visit_times,
	'pause' => true,
	'callback' => 'validate_time',
);

// look up this member by rfid
$member = !$rfid || $rfid == 'guest' ? false : get_member_by_rfid($rfid);

switch($callback) {
	case 'validate_name':

		if($_SESSION['signup_email']) {
			$name = trim( $answer );
			if ( !$name ) {
				$name = 'Unknown';
			}
			/// gctechspace.org/api/rfid/signup
			$create_response = wordpress_api( 'signup', array(
				'email' => $_SESSION['signup_email'],
				'name' => $name,
				'rfid'  => $rfid,
			) );

			switch($create_response){
				case 'success':
					$result['messages'][]     = array(
						'type' => 'message',
						'text' => 'Thanks '.htmlspecialchars($name).'!',
					);
					$result['messages'][] = $how_long_question;
					break;
				case 'fail':
					$result['messages'][] = array(
						'type' => 'message',
						'text' => 'Failed to create member account',
						'delay' => 5000,
					);
					$result['messages'][] = array(
						'type'     => 'function',
						'function' => 'closeOverlay',
						'delay'    => 5000
					);
					break;
				case 'existing':
					$result['messages'][] = array(
						'type' => 'message',
						'text' => 'Existing account found. Please go see Dave for manual RFID key assignment.',
						'delay' => 8000,
					);
					$result['messages'][] = array(
						'type'     => 'function',
						'function' => 'closeOverlay',
						'delay'    => 5000
					);
					break;
				default:
					$result['messages'][] = array(
						'type' => 'message',
						'text' => 'Sorry, something broke. Go see Dave.',
						'delay' => 5000,
					);
					$result['messages'][] = array(
						'type'     => 'function',
						'function' => 'closeOverlay',
						'delay'    => 5000
					);
					break;
			}


		}else{
			$result['messages'][] = array(
				'type' => 'message',
				'text' => 'Sorry, something broke. That\'s ok, enjoy your stay :) ',
			);
		}


		break;
	case 'validate_email':

		$email = filter_var( trim($answer), FILTER_VALIDATE_EMAIL);
		if($email){

			// check if this member already exists via email.
			$member = get_member_by_email($email);
			if($member){
				$member_rfid_key = '';
				if(!empty($member['rfid']) && is_array($member['rfid'])){
					foreach($member['rfid'] as $member_rfid){
						if(!empty($member_rfid)){
							$member_rfid_key = $member_rfid;
						}
					}
				}
				$name_bits = explode(' ',$member['member_name']);
				$result['messages'][] = array(
					'type' => 'message',
					'text' => 'Welcome ' . htmlspecialchars( $name_bits[0] ) . '!',
				);
				$result['messages'][] = array(
					'type'     => 'function',
					'function' => 'setManualRFID',
					'value' => $member_rfid_key,
					'delay'    => 10
				);

				$result['messages'][] = $how_long_question;
			}else {
				$_SESSION['signup_email'] = $email; // store this so we can ask their name next time.
				$result['messages'][]     = array(
					'type'     => 'input',
					'tag' => 'text',
					'text'     => 'What is your name (or nickname)?',
					'pause'    => true,
					'callback' => 'validate_name',
					'button'   => 'Next',
				);
			}

		}else{
			$result['messages'][] = array(
				'type' => 'input',
				'tag' => 'email',
				'value' => htmlspecialchars( $answer ),
				'text' => 'Invalid email, try again:',
				'pause' => true,
				'callback' => 'validate_email',
				'button' => 'Next',
			);
		}


		break;
	case 'validate_time':
		// user selected $answer index in $visit_times
		// post this to slack? post this to wordpress as well for logging.


		/// gctechspace.org/api/rfid/RFID_KEY/DEVICE_NAME
		wordpress_api( $rfid . '/ci', array(
			'post_checkin' => 'yes',
			//'rfid' => $rfid,
			'time'         => $visit_times[ $answer ],
		) );

		$name_bits = explode(' ',$member['member_name']);

		$result['messages'][] = array(
			'type' => 'message',
			'text' => 'Thanks ' . htmlspecialchars( $name_bits[0] ) . '!',
		);
		$result['messages'][] = array(
			'type'     => 'function',
			'function' => 'closeOverlay',
			'delay'    => 800
		);


		break;
	default:


		if(!$member){
			// guest mode. send welcome back along with signup form fields.
			/*$result['messages'][] = array(
				'type' => 'message',
				'text' => 'Welcome!',
				'once' => 'yes',
			);*/
			$result['messages'][] = array(
				'type' => 'input',
				'tag' => 'email',
				'text' => 'Welcome Guest! What is your email address?',
				'pause' => true,
				'callback' => 'validate_email',
				'button' => 'Next',
			);

		}else{
			// existing member.
			$name_bits = explode(' ',$member['member_name']);

			$result['messages'][] = array(
				'type' => 'message',
				'text' => 'Welcome '.htmlspecialchars($name_bits[0]) .'!',
			);

			if($member['membership_expiry_days'] > 0) {
				$result['messages'][] = array(
					'type' => 'message',
					'text' => 'Membership Status: Full Member (<strong>' . (int)$member['membership_expiry_days'].'</strong> days left).',
				);
			}else{
				$result['messages'][] = array(
					'type' => 'message',
					'warning' => true,
					'text' => 'Membership Status: Free Guest ',
				);
			}

			$result['messages'][] = $how_long_question;



		}


}


echo json_encode($result);