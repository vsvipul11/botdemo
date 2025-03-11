// Inside your Home component, update the Google Calendar handling
const calendarService = useMemo(() => GoogleCalendarService.getInstance(), []);

useEffect(() => {
  // Initialize Google Calendar service
  calendarService.init().catch(console.error);
}, [calendarService]);

// Update the debug message handling
useEffect(() => {
  if (callDebugMessages.length > 0) {
    const latestMessage = callDebugMessages[callDebugMessages.length - 1].message.message;
    setLastUpdateTime(new Date().toLocaleTimeString());

    // Try to parse consultation data
    const parsedData = parseConsultationData(latestMessage);
    if (parsedData) {
      console.log('Updating consultation data:', parsedData);
      setConsultationData(prevData => ({
        ...prevData,
        ...parsedData
      }));

      // Schedule calendar event if appointment is present
      if (parsedData.appointment?.email) {
        const { date, time, email } = parsedData.appointment;
        calendarService.createEvent(date, time, email)
          .catch(error => {
            console.error('Failed to create calendar event:', error);
            // The service already handles user alerts
          });
      }
    }
  }
}, [callDebugMessages, calendarService]);

// The rest of your Home component remains the same...