'use client';

import React, { useState, useEffect } from 'react';
import { UltravoxExperimentalMessageEvent } from 'ultravox-client';

interface Symptom {
  symptom: string;
  severity: string;
  duration: string;
}

interface Appointment {
  date: string;
  time: string;
}

interface ConsultationData {
  symptoms: Symptom[];
  appointment: Appointment;
  assessmentStatus: string;
}

const ConsultationDetails: React.FC<{ debugMessages?: UltravoxExperimentalMessageEvent[] }> = ({ debugMessages = [] }) => {
  const [consultationDetails, setConsultationDetails] = useState<ConsultationData>({
    symptoms: [],
    appointment: { date: '', time: '' },
    assessmentStatus: 'Not started'
  });

  useEffect(() => {
    if (!debugMessages?.length) return;

    // Find the most recent updateConsultation tool call
    const toolCalls = debugMessages
      .filter(msg => msg.message.message.includes('Tool calls:') && 
                    msg.message.message.includes('updateConsultation'))
      .map(msg => {
        try {
          // Extract the JSON from the tool call
          const match = msg.message.message.match(/args='([^']+)'/);
          if (match) {
            return JSON.parse(match[1]);
          }
        } catch (error) {
          console.error('Error parsing tool call:', error);
        }
        return null;
      })
      .filter(Boolean);

    if (toolCalls.length > 0) {
      const latestCall = toolCalls[toolCalls.length - 1];
      setConsultationDetails(latestCall.consultationData);
    }
  }, [debugMessages]);

  const formatSymptom = (symptom: Symptom, index: number) => (
    <div key={index} className="mb-4 border-l-4 border-red-500 pl-4 bg-white rounded-lg shadow-sm">
      <div className="text-gray-800 font-medium">{symptom.symptom}</div>
      <div className="mt-1 text-sm">
        <span className="text-red-600">Severity:</span> 
        <span className="text-gray-600 ml-2">{symptom.severity}</span>
      </div>
      <div className="text-sm">
        <span className="text-red-600">Duration:</span>
        <span className="text-gray-600 ml-2">{symptom.duration}</span>
      </div>
    </div>
  );

  return (
    <div className="mt-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 border-b-2 border-red-500 pb-2 mb-6">
        Conversation Notes
        </h1>
        
        {/* Assessment Status */}
        <div className="mb-6">
          <div className="text-red-600 font-semibold mb-2">Status</div>
          <div className="bg-red-50 p-3 rounded-md">
            {consultationDetails.assessmentStatus}
          </div>
        </div>

        {/* Debug Info */}
        <div className="mb-4 text-xs text-gray-500">
          Last update: {new Date().toLocaleTimeString()}
        </div>

        {/* Symptoms Section */}
        <div className="mb-6">
          <div className="text-red-600 font-semibold mb-2">Reported Symptoms</div>
          {consultationDetails.symptoms.length > 0 ? (
            consultationDetails.symptoms.map((symptom, index) => formatSymptom(symptom, index))
          ) : (
            <div className="text-gray-500 italic p-4 bg-gray-50 rounded-md">
              No symptoms reported yet
            </div>
          )}
        </div>

        {/* Appointment Section */}
        {(consultationDetails.appointment?.date || consultationDetails.appointment?.time) && (
          <div className="mt-8 bg-red-50 p-4 rounded-lg">
            <div className="text-red-600 font-semibold mb-2">Scheduled Appointment</div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-2 sm:mb-0">
                <span className="text-gray-700 font-medium">Date:</span>
                <span className="ml-2 text-gray-800">{consultationDetails.appointment.date}</span>
              </div>
              <div>
                <span className="text-gray-700 font-medium">Time:</span>
                <span className="ml-2 text-gray-800">{consultationDetails.appointment.time}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationDetails;