'use client'
import React, { 
  useState, 
  useCallback, 
  useEffect, 
  useRef, 
  useMemo, 
  Suspense 
} from 'react';
import { useSearchParams } from 'next/navigation';
import { startCall, endCall } from '@/lib/callFunctions';
import { Role, Transcript, UltravoxExperimentalMessageEvent } from 'ultravox-client';
import { PhoneOffIcon } from 'lucide-react';
import { CalComService } from '@/lib/calComService';
import MicToggleButton from './components/MicToggleButton';
import demoConfig, { 
  getConsultationData, 
  initializeSession,
  FETCH_SLOTS_EVENT 
} from './demo-config';
import axios from 'axios';
import SlotSelectionPopup from './components/SlotSelectionPopup';
import AppointmentDetailsCard from './components/AppointmentDetailsCard';
import { formatAvailableSlots, getDayFromDate } from './utils/format-slots-uti';


const AppointmentChecker = ({ onAppointmentsFound, phone_number }) => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAppointments = async () => {
    if (!phone_number) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(`https://test-cadambams-phytat.p7devs.com/appointment/?phone_number=${phone_number}`);
      const upcomingAppointments = response.data.upcoming_appointments || [];
      setAppointments(upcomingAppointments);
      
      if (upcomingAppointments.length > 0) {
        const appointmentText = upcomingAppointments.map(appt => {
          return `You have an appointment scheduled for ${appt.formatted_startdate} at ${appt.time} with ${appt.doctor_name}`;
        }).join('. ');
        onAppointmentsFound(appointmentText);
      } else {
        onAppointmentsFound("You don't have any upcoming appointments scheduled.");
      }
    } catch (err) {
      setError(err.message);
      onAppointmentsFound("I apologize, but I'm having trouble checking your appointments right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [phone_number]);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-gray-600">Checking your appointments...</div>
      ) : error ? (
        <div className="text-red-500">Error checking appointments: {error}</div>
      ) : (
        appointments.length > 0 ? (
          <div>
            <h3 className="text-lg font-semibold mb-2">Your Upcoming Appointments</h3>
            {appointments.map((appointment, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{appointment.doctor_name}</p>
                    <p className="text-sm text-gray-600">{appointment.formatted_startdate}</p>
                    <p className="text-sm text-gray-600">{appointment.time}</p>
                    <p className="text-sm text-gray-600">{appointment.consultation_type}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-full">
                    {appointment.appointment_stage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600">No upcoming appointments found.</div>
        )
      )}
    </div>
  );
};

const EmailPopup = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);

  const validateForm = (email, phone) => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRe = /^\d{10}$/;
    return emailRe.test(email) && phoneRe.test(phone);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid) {
      onSubmit(email, phoneNumber);
    }
  };

  useEffect(() => {
    setIsValid(validateForm(email, phoneNumber));
  }, [email, phoneNumber]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Welcome to Cadabam's Consult</h2>
        <p className="mb-4">Please enter your details to continue:</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter your phone number"
            className="w-full p-2 border border-gray-300 rounded"
            required
            pattern="[0-9]{10}"
          />
          <button
            type="submit"
            disabled={!isValid}
            className="w-full bg-blue-500 text-white p-2 rounded disabled:bg-gray-300"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

const SearchParamsContent = ({ children }) => {
  const searchParams = useSearchParams();
  const showMuteSpeakerButton = searchParams.get('showSpeakerMute') === 'true';
  const showDebugMessages = searchParams.get('showDebugMessages') === 'true';
  const showUserTranscripts = searchParams.get('showUserTranscripts') === 'true';
  let modelOverride;

  if (searchParams.get('model')) {
    modelOverride = 'fixie-ai/' + searchParams.get('model');
  }

  return children({
    showMuteSpeakerButton,
    modelOverride,
    showDebugMessages,
    showUserTranscripts,
  });
};

const SearchParamsHandler = (props) => {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center">
        <div className="max-w-[1206px] mx-auto w-full py-5 pl-5 pr-[10px] border border-[#2A2A2A] rounded-[3px]">
          Loading...
        </div>
      </div>
    }>
      <SearchParamsContent {...props} />
    </Suspense>
  );
};

// Function to show a notification
const showNotification = (message, type = 'info') => {
  // This is a simple implementation - you might want to use a toast library
  alert(message);
};

const Home = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isCallStarting, setIsCallStarting] = useState(false);
  const [agentStatus, setAgentStatus] = useState('Not Connected');
  const [callTranscript, setCallTranscript] = useState([]);
  const [callDebugMessages, setCallDebugMessages] = useState([]);
  const [customerProfileKey, setCustomerProfileKey] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [phone_number, setPhoneNumber] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(true);
  const [consultationData, setConsultationData] = useState({
    symptoms: [],
    assessmentStatus: 'Not started',
    appointment: {}
  });
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [updateCounter, setUpdateCounter] = useState(0);

  // New state for slot selection popup
  const [showSlotPopup, setShowSlotPopup] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const transcriptContainerRef = useRef(null);
  const calendarService = useMemo(() => CalComService.getInstance(), []);
  const demoConfigRef = useRef(null);
  const sessionRef = useRef(null);

  // Add event listener for fetch slots event
  useEffect(() => {
    const handleFetchSlotsEvent = (event) => {
      try {
        if (!event.detail || !event.detail.slotData) return;
        
        const { slotData } = event.detail;
        console.log("Received slot data event:", slotData);
        
        if (slotData && slotData.hourly_slots) {
          // Format and set available slots
          const slots = formatAvailableSlots(slotData.hourly_slots);
          
          // Only proceed if we have slots
          if (slots && slots.length > 0) {
            // Get day from search criteria
            let day = '';
            let location = '';
            
            if (slotData.search_criteria) {
              if (slotData.search_criteria.date) {
                day = getDayFromDate(slotData.search_criteria.date);
              }
              
              if (slotData.search_criteria.campus) {
                location = slotData.search_criteria.campus;
              }
            }
            
            // Set state for popup
            setAvailableSlots(slots);
            setSelectedDay(day);
            setSelectedLocation(location);
            setShowSlotPopup(true);
          }
        }
      } catch (error) {
        console.error("Error handling fetchSlots event:", error);
      }
    };

    // Add event listener
    document.addEventListener(FETCH_SLOTS_EVENT, handleFetchSlotsEvent);
    
    // Cleanup
    return () => {
      document.removeEventListener(FETCH_SLOTS_EVENT, handleFetchSlotsEvent);
    };
  }, []);

  const handleEmailSubmit = async (email, phoneNumber) => {
    setUserEmail(email);
    setPhoneNumber(phoneNumber);
    setShowEmailPopup(false);
    demoConfigRef.current = await demoConfig(email);
  };

  // Handle slot selection
  const handleSlotSelect = (slot) => {
    console.log('Selected slot:', slot);
    
    // Close the popup
    setShowSlotPopup(false);
    
    // Send user's selection to the agent
    if (sessionRef.current) {
      try {
        sessionRef.current.addMessage({
          id: `user-slot-selection-${Date.now()}`,
          role: "user",
          content: `I'd like the ${slot} slot please.`,
          created_at: new Date().toISOString()
        });
        
        // Also update the consultation data
        const updatedAppointment = {
          ...consultationData.appointment,
          selectedTime: slot,
          time: slot.split(" to ")[0] // Use the start time
        };
        
        setConsultationData(prevData => ({
          ...prevData,
          appointment: updatedAppointment
        }));
        
        // Force UI update
        setUpdateCounter(prev => prev + 1);
      } catch (error) {
        console.error("Error sending slot selection to agent:", error);
      }
    }
  };

  const handleAppointmentMessage = (message) => {
    if (message && message.trim() !== '') {
      setCallDebugMessages(prev => [...prev, {
        message: {
          message: `Dr. Riya: ${message}`
        }
      }]);
    }
  };

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [callTranscript, callDebugMessages]);

  // Add a new useEffect to fetch consultation data at regular intervals
  useEffect(() => {
    const fetchConsultationDataInterval = setInterval(() => {
      if (isCallActive) {
        // Get the latest consultation data from the module
        const latestData = getConsultationData();
        if (latestData) {
          setConsultationData(prevData => {
            // Only update if the data has actually changed
            if (JSON.stringify(prevData) !== JSON.stringify(latestData)) {
              return {
                symptoms: latestData.symptoms || prevData.symptoms,
                assessmentStatus: latestData.assessmentStatus || prevData.assessmentStatus,
                appointment: {
                  ...prevData.appointment,
                  ...latestData.appointment,
                }
              };
            }
            return prevData;
          });
          
          // Increment the update counter to force UI refresh
          setUpdateCounter(prev => prev + 1);
        }
      }
    }, 1000); // Poll every second

    return () => clearInterval(fetchConsultationDataInterval);
  }, [isCallActive]);

  // Parse and process debug messages
  useEffect(() => {
    if (callDebugMessages.length > 0) {
      const latestMessage = callDebugMessages[callDebugMessages.length - 1].message.message;
      setLastUpdateTime(new Date().toLocaleTimeString());

      // Check for booking details
      if (latestMessage.includes("appointment has been booked") || 
          latestMessage.includes("appointment is confirmed") ||
          latestMessage.includes("payment link") ||
          latestMessage.includes("rzp.io")) {
        
        // Process booking details
        const linkMatch = latestMessage.match(/(https:\/\/rzp\.io\/[^\s]+)/);
        const paymentLink = linkMatch ? linkMatch[1] : '';
        
        const doctorMatch = latestMessage.match(/with\s+([^.]+)\s+on/i) || 
                           latestMessage.match(/with\s+Dr\.\s+([^.]+)/i);
        const doctor = doctorMatch ? doctorMatch[1].trim() : '';
        
        const dateMatch = latestMessage.match(/on\s+(\d+(?:st|nd|rd|th)?\s+[A-Za-z]+)/i);
        const date = dateMatch ? dateMatch[1] : '';
        
        const timeMatch = latestMessage.match(/at\s+(\d+:\d+\s*(?:AM|PM))/i);
        const time = timeMatch ? timeMatch[1] : '';
        
        // Update consultation data with booking details
        if (paymentLink || doctor || date || time) {
          setConsultationData(prevData => ({
            ...prevData,
            appointment: {
              ...prevData.appointment,
              status: "Confirmed",
              paymentLink: paymentLink || prevData.appointment.paymentLink,
              doctor: doctor || prevData.appointment.doctor,
              date: date || prevData.appointment.date,
              time: time || prevData.appointment.time
            }
          }));
          
          // Force UI update
          setUpdateCounter(prev => prev + 1);
        }
      }

      const parsedData = parseConsultationData(latestMessage);
      if (parsedData) {
        setConsultationData((prevData) => {
          const newData = {
            symptoms: parsedData.symptoms && parsedData.symptoms.length > 0 
              ? parsedData.symptoms 
              : prevData.symptoms,
            assessmentStatus: parsedData.assessmentStatus || prevData.assessmentStatus,
            appointment: parsedData.appointment
              ? {
                  ...prevData.appointment,
                  ...(parsedData.appointment),
                  email: userEmail,
                }
              : prevData.appointment,
          };

          // Force UI update by incrementing counter
          setUpdateCounter(prev => prev + 1);

          if (
            !isBookingInProgress &&
            newData.appointment?.date &&
            newData.appointment?.time &&
            newData.appointment.date !== 'TBD' &&
            newData.appointment.time !== 'TBD'
          ) {
            setIsBookingInProgress(true);

            calendarService
              .createEvent(
                newData.appointment.date,
                newData.appointment.time,
                userEmail,
                'Patient'
              ).then((booking) => {
                console.log('Booking created:', booking);
                const meetingRef = booking.references?.find(
                  (ref) => ref.type === 'google_meet_video'
                );
                const meetingUrl = meetingRef?.meetingUrl;

                showNotification(
                  `Appointment scheduled successfully!${
                    meetingUrl ? `\nMeeting link: ${meetingUrl}` : ''
                  }`,
                  'success'
                );
              })
              .catch((error) => {
                console.error('Failed to schedule appointment:', error);
                showNotification(
                  'Failed to schedule appointment. Please try again.',
                  'error'
                );
              })
              .finally(() => {
                setIsBookingInProgress(false);
              });
          }

          return newData;
        });
      }
    }
  }, [callDebugMessages, calendarService, userEmail]);

  const handleStatusChange = useCallback((status) => {
    if (status) {
      setAgentStatus(status);
      setLastUpdateTime(new Date().toLocaleTimeString());
    } else {
      setAgentStatus('Not Connected');
    }
  }, []);

  const handleTranscriptChange = useCallback(
    (transcripts) => {
      if (transcripts) {
        setCallTranscript([...transcripts]);
        setLastUpdateTime(new Date().toLocaleTimeString());
      }
    },
    []
  );

  // Handle debug messages to capture symptom and booking data
  const handleDebugMessage = useCallback(
    (debugMessage) => {
      setCallDebugMessages((prevMessages) => [...prevMessages, debugMessage]);
      setLastUpdateTime(new Date().toLocaleTimeString());
      
      // Check for tool call messages
      if (debugMessage.message && debugMessage.message.message) {
        const message = debugMessage.message.message;
        
        // Check for booking information in the message
        if (message.includes("appointment has been booked") || 
            message.includes("appointment is confirmed") ||
            message.includes("payment link")) {
          // Extract booking details from the message
          const linkMatch = message.match(/(https:\/\/rzp\.io\/[^\s]+)/);
          if (linkMatch && linkMatch[1]) {
            // Update appointment data with payment link
            setConsultationData(prevData => ({
              ...prevData,
              appointment: {
                ...prevData.appointment,
                paymentLink: linkMatch[1],
                status: "Confirmed"
              }
            }));
            
            // Force a re-render
            setUpdateCounter(prev => prev + 1);
          }
        }
        
        // Check for tool calls or consultation data
        if (message.includes('Tool calls:') || message.includes('consultationData')) {
          const parsedData = parseConsultationData(message);
          if (parsedData) {
            // Directly update the state with the parsed data
            setConsultationData(prevData => ({
              symptoms: parsedData.symptoms && parsedData.symptoms.length > 0 
                ? parsedData.symptoms 
                : prevData.symptoms,
              assessmentStatus: parsedData.assessmentStatus || prevData.assessmentStatus,
              appointment: parsedData.appointment 
                ? { ...prevData.appointment, ...parsedData.appointment }
                : prevData.appointment
            }));
            
            // Force a re-render
            setUpdateCounter(prev => prev + 1);
          }
        }
        
        // Get fresh data from the module as a backup
        const freshData = getConsultationData();
        if (freshData) {
          setConsultationData(prevData => {
            // Only update if something has changed
            if (JSON.stringify(prevData) !== JSON.stringify(freshData)) {
              return {
                symptoms: freshData.symptoms || prevData.symptoms,
                assessmentStatus: freshData.assessmentStatus || prevData.assessmentStatus,
                appointment: {
                  ...prevData.appointment,
                  ...freshData.appointment
                }
              };
            }
            return prevData;
          });
          
          // Force a re-render
          setUpdateCounter(prev => prev + 1);
        }
      }
    },
    []
  );

  const clearCustomerProfile = useCallback(() => {
    setCustomerProfileKey((prev) => (prev ? `${prev}-cleared` : 'cleared'));
  }, []);

  const getCallStatus = () => {
    if (!isCallActive) return 'Not started';
    if (agentStatus === 'Call started successfully') return 'In progress';
    return agentStatus;
  };

  const handleStartCallButtonClick = async (
    modelOverride,
    showDebugMessages
  ) => {
    if (isCallStarting || isCallActive || !demoConfigRef.current) return;

    try {
      setIsCallStarting(true);
      handleStatusChange('Starting call...');
      setCallTranscript(null);
      setCallDebugMessages([]);
      clearCustomerProfile();

      const newKey = `call-${Date.now()}`;
      setCustomerProfileKey(newKey);

      let callConfig = {
        ...demoConfigRef.current.callConfig,
        model: modelOverride || demoConfigRef.current.callConfig.model,
      };

      const joinUrl = await startCall(
        {
          onStatusChange: handleStatusChange,
          onTranscriptChange: handleTranscriptChange,
          onDebugMessage: handleDebugMessage,
        },
        callConfig,
        showDebugMessages
      );

      // Initialize session and store the reference
      const session = initializeSession(joinUrl);
      sessionRef.current = session;

      setIsCallActive(true);
      handleStatusChange('Call started successfully');
    } catch (error) {
      handleStatusChange(
        `Error starting call: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsCallStarting(false);
    }
  };

  const handleEndCallButtonClick = async () => {
    try {
      handleStatusChange('Ending call...');
      await endCall();
      setIsCallActive(false);
      clearCustomerProfile();
      setCustomerProfileKey(null);
      handleStatusChange('Call ended successfully');
    } catch (error) {
      handleStatusChange(
        `Error ending call: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  // Parse consultation data from message
  const parseConsultationData = (message) => {
    try {
      if (message.includes('Tool calls:')) {
        const jsonStart = message.indexOf('{');
        const jsonEnd = message.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = message.slice(jsonStart, jsonEnd);
          const data = JSON.parse(jsonStr);

          console.log('Parsed consultation data:', data);

          // Check all possible paths for consultationData
          const consultationData = 
            data.consultationData || 
            data.value?.consultationData || 
            data.value || 
            data;

          return {
            symptoms: Array.isArray(consultationData.symptoms) 
              ? consultationData.symptoms 
              : [],
            assessmentStatus: consultationData.assessmentStatus || 'In Progress',
            appointment: consultationData.appointment || undefined,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error parsing consultation data:', error);
      return null;
    }
  };

  return (
    <>
      {showEmailPopup && <EmailPopup onSubmit={handleEmailSubmit} />}
      
      {/* Slot Selection Popup */}
      <SlotSelectionPopup
        isOpen={showSlotPopup}
        slots={availableSlots}
        day={selectedDay}
        location={selectedLocation}
        onSelect={handleSlotSelect}
        onClose={() => setShowSlotPopup(false)}
      />
      
      <SearchParamsHandler>
        {({
          showMuteSpeakerButton,
          modelOverride,
          showDebugMessages,
          showUserTranscripts,
        }) => (
          <div className="flex flex-col items-center justify-center">
            <div className="max-w-[1206px] mx-auto w-full py-5 pl-5 pr-[10px] border border-[#2A2A2A] rounded-[3px]">
              <div className="flex flex-col justify-center lg:flex-row">
                <div className="w-full lg:w-2/3">
                  <h1 className="text-2xl font-bold w-full">
                    {demoConfigRef.current?.title || "Dr. Riya - Your Mental Health Triage"}
                  </h1>
                  <div className="flex flex-col justify-between items-start h-full font-mono p-4">
                    {isCallActive ? (
                      <div className="w-full">
                        <div className="flex justify-between space-x-4 p-4 w-full">
                          <MicToggleButton role={Role.USER} />
                          {showMuteSpeakerButton && (
                            <MicToggleButton role={Role.AGENT} />
                          )}
                          <button
                            type="button"
                            className="flex-grow flex items-center justify-center h-10 bg-red-500 text-white"
                            onClick={handleEndCallButtonClick}
                            disabled={!isCallActive}
                          >
                            <PhoneOffIcon width={24} className="brightness-0 invert" />
                            <span className="ml-2">End Call</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <div className="h-[300px] p-2.5 overflow-y-auto relative bg-white">
                          {callDebugMessages.map((msg, index) => (
                            <div
                              key={index}
                              className="text-sm text-gray-600 py-2 font-mono"
                            >
                              {msg.message.message.replace(
                                "LLM response:",
                                "Dr. Riya:"
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="w-full mt-4 h-10 bg-blue-500 text-white disabled:bg-gray-400"
                          onClick={() =>
                            handleStartCallButtonClick(
                              modelOverride,
                              showDebugMessages
                            )
                          }
                          disabled={isCallStarting || !userEmail}
                        >
                          {isCallStarting ? "Starting Call..." : "Start Call"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-[300px] ml-4">
                  <div className="border border-gray-200 rounded p-4 sticky top-4">
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold mb-2">Call Status</h2>
                        <p className="text-gray-500">Status: {getCallStatus()}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Last update: {lastUpdateTime || "Not started"}
                        </p>
                      </div>

                      {/* Appointment Checker Section */}
                      <div className="mt-4">
                        <h3 className="text-red-500 font-medium mb-2">Appointment Status</h3>
                        <AppointmentChecker 
                          onAppointmentsFound={handleAppointmentMessage}
                          phone_number={phone_number}
                        />
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold border-b border-red-500 pb-1 mb-4">
                          Consultation Notes
                        </h2>

                        <div className="space-y-4">
                          <div>
                            <h3 className="text-red-500 font-medium">
                              Assessment Status
                            </h3>
                            <p className="bg-red-50 p-2 mt-1">
                              {consultationData.assessmentStatus}
                            </p>
                          </div>

                          <div>
                            <h3 className="text-red-500 font-medium">
                              Reported Symptoms
                            </h3>
                            <div className="mt-2 space-y-3">
                              {consultationData.symptoms &&
                              consultationData.symptoms.length > 0 ? (
                                consultationData.symptoms.map((symptom, index) => (
                                  <div
                                    key={`symptom-${index}-${symptom.symptom}-${updateCounter}`}
                                    className="bg-red-50 p-3 rounded"
                                  >
                                   <span
                                      className="font-medium text-gray-900"
                                    >
                                      {symptom.symptom}
                                    </span>
                                    <div className="mt-1 text-sm text-gray-600">
                                      <div>Duration: {symptom.duration || 'Not specified'}</div>
                                      <div>Severity: {symptom.severity || 'Not specified'}</div>
                                      {symptom.location && <div>Location: {symptom.location}</div>}
                                      {symptom.pattern && <div>Pattern: {symptom.pattern}</div>}
                                      {symptom.movementImpact && <div>Movement Impact: {symptom.movementImpact}</div>}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-gray-500 italic">
                                  No symptoms reported yet
                                </p>
                              )}
                            </div>
                          </div>

                          {/* New Appointment Details Card */}
                          {consultationData.appointment && 
                           Object.keys(consultationData.appointment).length > 0 && (
                            <AppointmentDetailsCard 
                              appointment={{
                                ...consultationData.appointment,
                                email: userEmail,
                                phone: phone_number
                              }} 
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SearchParamsHandler>
    </>
  );
};

export default Home;