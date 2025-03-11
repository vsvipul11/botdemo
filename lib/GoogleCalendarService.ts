// src/lib/GoogleCalendarService.ts

interface TokenResponse {
    access_token: string;
    error?: string;
    expires_in: number;
  }
  
  export class GoogleCalendarService {
      private static instance: GoogleCalendarService;
      private tokenClient: any;
      private gapi: any;
      private initialized: boolean = false;
      private initializationPromise: Promise<void> | null = null;
      private accessToken: string | null = null;
  
      private constructor() {}
  
      static getInstance(): GoogleCalendarService {
          if (!GoogleCalendarService.instance) {
              GoogleCalendarService.instance = new GoogleCalendarService();
          }
          return GoogleCalendarService.instance;
      }
  
      public isInitialized(): boolean {
          return this.initialized && !!this.gapi;
      }
  
      async init(): Promise<void> {
          if (this.initialized) return;
          
          if (this.initializationPromise) {
              return this.initializationPromise;
          }
  
          this.initializationPromise = new Promise((resolve, reject) => {
              try {
                  const gapi = (window as any).gapi;
                  const google = (window as any).google;
  
                  if (!gapi || !google) {
                      reject(new Error('Google APIs not loaded'));
                      return;
                  }
  
                  // First initialize Google Identity Services
                  google.accounts.id.initialize({
                      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                      callback: (response: any) => {
                          console.log('Google Identity Services initialized');
                      }
                  });
  
                  // Then initialize GAPI client
                  gapi.load('client', async () => {
                      try {
                          await gapi.client.init({
                              apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
                              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
                          });
  
                          // Initialize OAuth2 token client
                          this.tokenClient = google.accounts.oauth2.initTokenClient({
                              client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
                              scope: 'https://www.googleapis.com/auth/calendar.events',
                              callback: (tokenResponse: TokenResponse) => {
                                  if (tokenResponse.error !== undefined) {
                                      reject(new Error(tokenResponse.error));
                                      return;
                                  }
                                  
                                  this.accessToken = tokenResponse.access_token;
                                  this.gapi.client.setToken({
                                      access_token: this.accessToken,
                                      expires_in: tokenResponse.expires_in
                                  });
                                  
                                  this.initialized = true;
                                  resolve();
                              },
                          });
  
                          this.gapi = gapi;
                          resolve();
                      } catch (err) {
                          console.error('Error initializing GAPI client:', err);
                          reject(err);
                      }
                  });
              } catch (err) {
                  console.error('Error loading GAPI:', err);
                  reject(err);
              }
          });
  
          try {
              await this.initializationPromise;
          } catch (error) {
              this.initializationPromise = null;
              this.initialized = false;
              throw error;
          }
  
          return this.initializationPromise;
      }
  
      private async handleTokenRefresh(): Promise<void> {
          return new Promise((resolve, reject) => {
              if (!this.tokenClient) {
                  reject(new Error('Token client not initialized'));
                  return;
              }
  
              this.tokenClient.callback = (response: TokenResponse) => {
                  if (response.error !== undefined) {
                      reject(new Error(response.error));
                      return;
                  }
                  
                  this.accessToken = response.access_token;
                  this.gapi.client.setToken({
                      access_token: this.accessToken,
                      expires_in: response.expires_in
                  });
                  
                  resolve();
              };
  
              if (!this.accessToken) {
                  this.tokenClient.requestAccessToken({ prompt: 'consent' });
              } else {
                  this.tokenClient.requestAccessToken({ prompt: '' });
              }
          });
      }
  
      async signIn(): Promise<void> {
          if (!this.isInitialized()) {
              await this.init();
          }
  
          if (!this.tokenClient) {
              throw new Error('Service not initialized');
          }
          
          return new Promise((resolve, reject) => {
              try {
                  this.tokenClient.callback = (response: TokenResponse) => {
                      if (response.error !== undefined) {
                          reject(new Error(response.error));
                          return;
                      }
                      
                      this.accessToken = response.access_token;
                      this.gapi.client.setToken({
                          access_token: this.accessToken,
                          expires_in: response.expires_in
                      });
                      
                      resolve();
                  };
                  
                  this.tokenClient.requestAccessToken({
                      prompt: 'consent',
                      state: 'try_sample_request'
                  });
              } catch (err) {
                  reject(err);
              }
          });
      }
  
      async createEvent(date: string, time: string, email: string): Promise<any> {
          try {
              // Ensure service is initialized
              if (!this.isInitialized()) {
                  await this.init();
              }
  
              // Ensure we have a valid token
              if (!this.accessToken) {
                  await this.handleTokenRefresh();
              }
  
              // Combine date and time for event
              const startDateTime = new Date(`${date}T${time}`);
              const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
  
              const event = {
                  'summary': 'Mental Health Consultation - Cadabam\'s Consult',
                  'description': 'Video consultation with Dr. Riya',
                  'start': {
                      'dateTime': startDateTime.toISOString(),
                      'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
                  },
                  'end': {
                      'dateTime': endDateTime.toISOString(),
                      'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
                  },
                  'attendees': [
                      {'email': email}
                  ],
                  'reminders': {
                      'useDefault': false,
                      'overrides': [
                          {'method': 'email', 'minutes': 24 * 60},
                          {'method': 'popup', 'minutes': 30}
                      ]
                  },
                  'conferenceData': {
                      'createRequest': {
                          'requestId': `consultation-${Date.now()}`,
                          'conferenceSolutionKey': {
                              'type': 'hangoutsMeet'
                          }
                      }
                  }
              };
  
              try {
                  const request = await this.gapi.client.calendar.events.insert({
                      'calendarId': 'primary',
                      'resource': event,
                      'sendUpdates': 'all',
                      'conferenceDataVersion': 1,
                      'headers': {
                          'Authorization': `Bearer ${this.accessToken}`
                      }
                  });
  
                  return request.result;
              } catch (apiError) {
                  console.error('Calendar API Error:', apiError);
                  if (apiError.status === 401) {
                      // Token expired, try refreshing
                      await this.handleTokenRefresh();
                      // Retry the request
                      const retryRequest = await this.gapi.client.calendar.events.insert({
                          'calendarId': 'primary',
                          'resource': event,
                          'sendUpdates': 'all',
                          'conferenceDataVersion': 1,
                          'headers': {
                              'Authorization': `Bearer ${this.accessToken}`
                          }
                      });
                      return retryRequest.result;
                  }
                  throw apiError;
              }
          } catch (error) {
              console.error('Error creating calendar event:', error);
              throw error;
          }
      }
  }