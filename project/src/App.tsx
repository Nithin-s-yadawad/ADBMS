import React, { useState, useEffect } from 'react';
import { BookOpen, Users, Search, Star, Clock, Award, Briefcase, LogOut, GraduationCap, BookOpen as CourseIcon } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Course, Enrollment } from './types/database.types';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'courses' | 'enrolled'>('courses');
  const [enrollmentStatus, setEnrollmentStatus] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching courses:', error);
      } else {
        setCourses(data || []);
      }
    }

    fetchCourses();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchEnrollments();
    }
  }, [session?.user?.id]);

  async function fetchEnrollments() {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        courses (*)
      `)
      .eq('student_id', session?.user?.id);

    if (error) {
      console.error('Error fetching enrollments:', error);
    } else {
      setEnrollments(data || []);
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      document.getElementById('authModal')?.classList.add('hidden');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      document.getElementById('authModal')?.classList.add('hidden');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setActiveTab('courses');
  };

  const handleEnroll = async (courseId: string) => {
    if (!session) return;

    setEnrollmentStatus(prev => ({ ...prev, [courseId]: 'pending' }));

    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const status = course.available_seats > 0 ? 'enrolled' : 'waitlisted';

    const { error } = await supabase
      .from('enrollments')
      .insert([
        {
          student_id: session.user.id,
          course_id: courseId,
          status
        }
      ]);

    if (error) {
      console.error('Error enrolling:', error);
      setEnrollmentStatus(prev => ({ ...prev, [courseId]: 'error' }));
    } else {
      if (status === 'enrolled') {
        // Update available seats
        await supabase
          .from('courses')
          .update({ available_seats: course.available_seats - 1 })
          .eq('id', courseId);
      }
      
      fetchEnrollments();
      setEnrollmentStatus(prev => ({ ...prev, [courseId]: 'success' }));
      
      // Refresh courses to get updated seat count
      const { data: updatedCourses } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (updatedCourses) {
        setCourses(updatedCourses);
      }
    }
  };

  const filteredCourses = courses.filter(course => 
    course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.instructor?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const enrolledCourses = enrollments
    .filter(enrollment => enrollment.status === 'enrolled')
    .map(enrollment => ({
      ...enrollment,
      course: courses.find(course => course.id === enrollment.course_id)
    }));

  const waitlistedCourses = enrollments
    .filter(enrollment => enrollment.status === 'waitlisted')
    .map(enrollment => ({
      ...enrollment,
      course: courses.find(course => course.id === enrollment.course_id)
    }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">EduEnroll</h1>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search for courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <nav className="flex space-x-4">
              {session ? (
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setActiveTab('courses')}
                      className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                        activeTab === 'courses'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <CourseIcon className="h-4 w-4 inline mr-2" />
                      Courses
                    </button>
                    <button
                      onClick={() => setActiveTab('enrolled')}
                      className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                        activeTab === 'enrolled'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <GraduationCap className="h-4 w-4 inline mr-2" />
                      My Courses
                    </button>
                  </div>
                  <span className="text-sm text-gray-700">{session.user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex space-x-4">
                  <button
                    onClick={() => document.getElementById('authModal')?.classList.remove('hidden')}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700"
                  >
                    Sign In / Sign Up
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <div id="authModal" className="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-6">Sign In / Sign Up</h2>
          <form onSubmit={handleSignIn} className="space-y-4">
            {authError && (
              <div className="bg-red-100 text-red-700 p-3 rounded">{authError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                Sign Up
              </button>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById('authModal')?.classList.add('hidden')}
              className="mt-4 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>

      {activeTab === 'courses' ? (
        <>
          {/* Hero Section */}
          <div className="pt-24 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <div className="text-center">
                <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  Learn Without Limits
                </h2>
                <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
                  Start, switch, or advance your career with thousands of courses from top universities and companies.
                </p>
                <div className="mt-8">
                  <button 
                    onClick={() => document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-8 py-3 text-lg font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700"
                  >
                    Explore Courses
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Available Courses */}
          <div id="courses" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-8">Available Courses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => {
                const isEnrolled = enrollments.some(e => e.course_id === course.id);
                const enrollmentForCourse = enrollments.find(e => e.course_id === course.id);
                
                return (
                  <div key={course.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl font-semibold text-gray-900">{course.name}</h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          {course.code}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4">{course.description}</p>
                      <div className="flex items-center text-sm text-gray-500 mb-4">
                        <Users className="h-4 w-4 mr-2" />
                        <span>{course.available_seats} seats available</span>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Instructor:</span> {course.instructor}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Credits:</span> {course.credits}
                        </div>
                      </div>
                      {session && (
                        isEnrolled ? (
                          <div className="mt-4 text-center py-2 bg-green-50 text-green-700 rounded-md">
                            {enrollmentForCourse?.status === 'enrolled' ? 'Enrolled' : 'Waitlisted'}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEnroll(course.id)}
                            disabled={enrollmentStatus[course.id] === 'pending'}
                            className={`mt-4 w-full px-4 py-2 rounded-md transition-colors ${
                              enrollmentStatus[course.id] === 'pending'
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {enrollmentStatus[course.id] === 'pending' ? (
                              <span>Enrolling...</span>
                            ) : course.available_seats > 0 ? (
                              'Enroll Now'
                            ) : (
                              'Join Waitlist'
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-gray-50 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-12 text-center">Why Choose EduEnroll?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 mx-auto mb-4">
                    <Award className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">World-Class Quality</h4>
                  <p className="text-gray-600">Learn from leading universities and companies</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 mx-auto mb-4">
                    <Clock className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">Flexible Learning</h4>
                  <p className="text-gray-600">Study at your own pace, on your schedule</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 mx-auto mb-4">
                    <Users className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">Active Community</h4>
                  <p className="text-gray-600">Join millions of learners worldwide</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 mx-auto mb-4">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">Career Advancement</h4>
                  <p className="text-gray-600">Earn certificates and degrees</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* My Courses Dashboard */
        <div className="pt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">Enrolled Courses</h3>
              {enrolledCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {enrolledCourses.map((enrollment) => (
                    enrollment.course && (
                      <div key={enrollment.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-xl font-semibold text-gray-900">{enrollment.course.name}</h4>
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                              Enrolled
                            </span>
                          </div>
                          <p className="text-gray-600 mb-4">{enrollment.course.description}</p>
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Instructor:</span> {enrollment.course.instructor}
                            </div>
                            <div>
                              <span className="font-medium">Credits:</span> {enrollment.course.credits}
                            </div>
                          </div>
                          {enrollment.grade && (
                            <div className="mt-4 text-center py-2 bg-blue-50 text-blue-700 rounded-md">
                              Grade: {enrollment.grade}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">You haven't enrolled in any courses yet.</p>
              )}
            </div>

            {waitlistedCourses.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Waitlisted Courses</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {waitlistedCourses.map((enrollment) => (
                    enrollment.course && (
                      <div key={enrollment.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-xl font-semibold text-gray-900">{enrollment.course.name}</h4>
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                              Waitlisted
                            </span>
                          </div>
                          <p className="text-gray-600 mb-4">{enrollment.course.description}</p>
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Instructor:</span> {enrollment.course.instructor}
                            </div>
                            <div>
                              <span className="font-medium">Credits:</span> {enrollment.course.credits}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;