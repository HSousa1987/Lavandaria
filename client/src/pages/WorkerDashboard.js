import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const WorkerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Jobs state
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDetails, setShowJobDetails] = useState(false);

  // Time tracking state
  const [activeJob, setActiveJob] = useState(null);
  const [startTime, setStartTime] = useState(null);

  // Photo upload state
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photoPreview, setPhotoPreview] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Completion form state
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompletionForm, setShowCompletionForm] = useState(false);

  useEffect(() => {
    fetchAssignedJobs();
  }, []);

  const fetchAssignedJobs = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get('/api/airbnb');
      setAssignedJobs(response.data);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assigned jobs');
      console.error('Jobs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleStartJob = async (job) => {
    try {
      setError('');
      const response = await axios.post(`/api/airbnb/${job.id}/time/start`);
      setActiveJob(job);
      setStartTime(new Date());
      setSuccess('Job started successfully!');
      fetchAssignedJobs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start job');
    }
  };

  const handleEndJob = (job) => {
    setSelectedJob(job);
    setShowCompletionForm(true);
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedPhotos(files);

    // Generate preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setPhotoPreview(previews);
  };

  const handleRemovePhoto = (index) => {
    const newPhotos = [...selectedPhotos];
    const newPreviews = [...photoPreview];

    // Revoke the URL to prevent memory leaks
    URL.revokeObjectURL(newPreviews[index]);

    newPhotos.splice(index, 1);
    newPreviews.splice(index, 1);

    setSelectedPhotos(newPhotos);
    setPhotoPreview(newPreviews);
  };

  const handleSubmitCompletion = async (e) => {
    e.preventDefault();

    if (selectedPhotos.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    try {
      setUploadingPhotos(true);
      setError('');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('notes', completionNotes);
      formData.append('startTime', startTime?.toISOString() || '');
      formData.append('endTime', new Date().toISOString());

      // Append all photos
      selectedPhotos.forEach((photo, index) => {
        formData.append('photos', photo);
      });

      await axios.post(`/api/airbnb/${selectedJob.id}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess('Job completed successfully!');
      setShowCompletionForm(false);
      setSelectedJob(null);
      setActiveJob(null);
      setStartTime(null);
      setSelectedPhotos([]);
      setPhotoPreview([]);
      setCompletionNotes('');
      fetchAssignedJobs();

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit job completion');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleViewJobDetails = (job) => {
    setSelectedJob(job);
    setShowJobDetails(true);
  };

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = () => {
    if (!startTime) return '00:00:00';
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Update timer display
  useEffect(() => {
    let interval;
    if (activeJob && startTime) {
      interval = setInterval(() => {
        // Force re-render to update time
        setStartTime(new Date(startTime));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeJob, startTime]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Worker Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name || 'Worker'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-green-700 hover:text-green-900">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Active Job Timer */}
      {activeJob && startTime && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Active Job: {activeJob.address}</p>
                <p className="text-xs text-blue-600">Job started</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{formatDuration()}</p>
                <button
                  onClick={() => handleEndJob(activeJob)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  End Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Assigned Cleaning Jobs</h2>
          <p className="text-sm text-gray-600">View and manage your assigned Airbnb cleaning tasks</p>
        </div>

        {assignedJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No assigned jobs</h3>
            <p className="mt-1 text-sm text-gray-500">You don't have any cleaning jobs assigned at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getJobStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    <span className="text-sm text-gray-500">Job #{job.id}</span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Property Address</p>
                      <p className="font-medium text-gray-900">{job.address}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Scheduled Date</p>
                      <p className="font-medium text-gray-900">
                        {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    {job.checkInTime && (
                      <div>
                        <p className="text-sm text-gray-500">Check-in Time</p>
                        <p className="font-medium text-gray-900">{job.checkInTime}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {job.status === 'assigned' && !activeJob && (
                      <button
                        onClick={() => handleStartJob(job)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Start Job
                      </button>
                    )}
                    {job.status === 'in-progress' && activeJob?.id === job.id && (
                      <button
                        onClick={() => handleEndJob(job)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Complete Job
                      </button>
                    )}
                    <button
                      onClick={() => handleViewJobDetails(job)}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Job Details Modal */}
      {showJobDetails && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Job Details</h3>
              <button
                onClick={() => setShowJobDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Job ID</p>
                  <p className="font-medium text-gray-900">#{selectedJob.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getJobStatusColor(selectedJob.status)}`}>
                    {selectedJob.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Property Address</p>
                  <p className="font-medium text-gray-900">{selectedJob.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Scheduled Date</p>
                  <p className="font-medium text-gray-900">
                    {selectedJob.scheduledDate ? new Date(selectedJob.scheduledDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                {selectedJob.checkInTime && (
                  <div>
                    <p className="text-sm text-gray-500">Check-in Time</p>
                    <p className="font-medium text-gray-900">{selectedJob.checkInTime}</p>
                  </div>
                )}
              </div>

              {selectedJob.instructions && (
                <div>
                  <p className="text-sm text-gray-500">Special Instructions</p>
                  <p className="font-medium text-gray-900">{selectedJob.instructions}</p>
                </div>
              )}

              {selectedJob.contactName && (
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="font-medium text-gray-900">{selectedJob.contactName}</p>
                  {selectedJob.contactPhone && (
                    <p className="text-sm text-gray-600">{selectedJob.contactPhone}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowJobDetails(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Form Modal */}
      {showCompletionForm && selectedJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Complete Job</h3>
              <button
                onClick={() => {
                  setShowCompletionForm(false);
                  setSelectedPhotos([]);
                  setPhotoPreview([]);
                  setCompletionNotes('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitCompletion} className="space-y-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Photos (Required)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">Select multiple photos to upload</p>
              </div>

              {/* Photo Previews */}
              {photoPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Selected Photos ({photoPreview.length})</p>
                  <div className="grid grid-cols-3 gap-4">
                    {photoPreview.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completion Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Completion Notes
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes or observations about the cleaning..."
                />
              </div>

              {/* Time Summary */}
              {startTime && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Time worked: <span className="font-semibold text-gray-900">{formatDuration()}</span></p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploadingPhotos}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {uploadingPhotos ? 'Submitting...' : 'Submit Completion'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCompletionForm(false);
                    setSelectedPhotos([]);
                    setPhotoPreview([]);
                    setCompletionNotes('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
