import React, { useEffect, useState } from 'react';
import { useEMagazineStore } from '../../stores/emagazineStore';
import emagazineAPI from '../../utils/emagazineApi';

export default function PageViewer() {
  const { currentPage, currentEditionId, setLoading } = useEMagazineStore();
  const [pageContent, setPageContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentEditionId) return;

    const loadPageContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const content = await emagazineAPI.getPage(currentEditionId, currentPage);
        setPageContent(content);

        // Track page view
        await emagazineAPI.trackAnalytics(currentEditionId, 'page_view', {
          pageNumber: currentPage,
        });
      } catch (err) {
        console.error('Error loading page:', err);
        setError('Failed to load page content');
      } finally {
        setLoading(false);
      }
    };

    loadPageContent();
  }, [currentPage, currentEditionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading page {currentPage}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 font-semibold">{error}</p>
          <p className="text-gray-600 text-sm mt-2">Page {currentPage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-100">
      <div className="flex items-center justify-center min-h-full p-4">
        <div className="bg-white shadow-lg rounded-lg max-w-4xl w-full">
          {/* Page Header */}
          <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {pageContent?.title || `Page ${currentPage}`}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {pageContent?.section_name} • Page {pageContent?.page_number}
                </p>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="px-6 py-8 max-h-[70vh] overflow-y-auto">
            {pageContent?.searchable_text ? (
              <div className="prose prose-sm max-w-none">
                {pageContent.searchable_text.split('\n').map((line, idx) => (
                  <p key={idx} className="text-gray-700 mb-2 leading-relaxed">
                    {line || <br />}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <p>No content available for this page</p>
              </div>
            )}
          </div>

          {/* Page Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 text-center text-sm text-gray-600">
            Page {pageContent?.page_number}
          </div>
        </div>
      </div>
    </div>
  );
}
