'use client';

import React, { useEffect, useState } from 'react';
import {
    Header,
    UploadSection,
    QuerySection,
    ImageCard,
    PersonCard,
    RelationshipSection,
    EventTimeline,
    SearchSection,
    NetworkGraph,
    MergePeopleSection,
    JournalSection,
    MapView,
    FlashbackSection
} from "@/components/image-memory";
import { getAllImages, getAllPeople, getAllRelationships, getAllEvents, getJournals, resetAllData } from '@/lib/api';

export default function Home() {
    const [images, setImages] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [relationships, setRelationships] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]);
    const [currentTab, setCurrentTab] = useState<'gallery' | 'people' | 'relationships' | 'timeline' | 'journal' | 'map'>('gallery');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterPersonId, setFilterPersonId] = useState<string | null>(null);
    const [filterLocation, setFilterLocation] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [imageData, peopleData, relData, eventData, journalData] = await Promise.all([
                getAllImages(),
                getAllPeople(),
                getAllRelationships(),
                getAllEvents(),
                getJournals()
            ]);
            //@ts-expect-error
            setImages(imageData || []);
            //@ts-expect-error
            setPeople(peopleData || []);
            //@ts-expect-error
            setRelationships(relData || []);
            //@ts-ignore
            setEvents(eventData || []);
            //@ts-ignore
            setJournals(journalData || []);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch data:', err);
            setError('Could not connect to the backend. Please ensure the backend is running.');
        } finally {
            setIsLoading(false);
        }
    };

    const availableLocations = Array.from(new Set(
        images.map(img => img.analysis?.locationContext).filter(Boolean)
    )) as string[];

    const filteredImages = images.filter(img => {
        const matchesPerson = filterPersonId ? img.detectedPersonIds?.includes(filterPersonId) : true;
        const matchesLocation = filterLocation ? img.analysis?.locationContext === filterLocation : true;
        return matchesPerson && matchesLocation;
    });

    const handlePersonClick = (personId: string) => {
        setFilterPersonId(personId);
        setCurrentTab('gallery');
    };

    const handleReset = async () => {
        if (window.confirm('Are you absolutely sure you want to clear all memories? This cannot be undone.')) {
            try {
                await resetAllData();
                fetchData();
                alert('All data has been cleared.');
            } catch (err) {
                console.error('Reset failed:', err);
                alert('Failed to clear data.');
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (images.length > 0) {
            // Use the dominant color of the most recent image for vibrant theming
            const recentImage = images[images.length - 1];
            if (recentImage.dominantColor) {
                document.documentElement.style.setProperty('--theme-accent', recentImage.dominantColor);
            }
        }
    }, [images]);

    return (
        <main style={{ minHeight: '100vh', padding: '2rem 1rem max(5vw, 2rem)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <Header />

                {/* Stats Overview */}
                {!isLoading && !error && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '1rem',
                        marginBottom: '2rem',
                        animation: 'slide-up 0.5s ease-out'
                    }}>
                        {[
                            { label: 'Photos', value: images.length },
                            { label: 'People', value: people.length },
                            { label: 'Connections', value: relationships.length },
                            { label: 'Events', value: events.length }
                        ].map((stat, i) => (
                            <div key={i} className="glass" style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-primary)' }}>{stat.value}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                <FlashbackSection />

                <UploadSection onUploadSuccess={fetchData} />

                <SearchSection people={people} />

                <QuerySection />

                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {['gallery', 'people', 'relationships', 'timeline', 'journal', 'map'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setCurrentTab(tab as any)}
                                className={currentTab === tab ? 'tab-active' : 'tab-inactive'}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '100px',
                                    backgroundColor: currentTab === tab ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                                    color: currentTab === tab ? 'white' : 'var(--text-secondary)',
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    border: '1px solid var(--glass-border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {tab === 'people' ? 'Identity Vault' : tab === 'relationships' ? 'Network Explorer' : tab === 'timeline' ? 'Timeline' : 'Gallery'}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={fetchData}
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.875rem',
                                textDecoration: 'none',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)',
                                cursor: 'pointer'
                            }}
                        >
                            🔄 Sync
                        </button>
                        <button
                            onClick={handleReset}
                            style={{
                                color: '#ef4444',
                                fontSize: '0.875rem',
                                textDecoration: 'none',
                                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                cursor: 'pointer'
                            }}
                        >
                            🗑️ Reset
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="glass" style={{ height: '300px', opacity: 0.3 }}></div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
                        {error}
                    </div>
                ) : (
                    <>
                        {currentTab === 'gallery' && (
                            <>
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>FILTER BY LOCATION:</span>
                                    <button
                                        onClick={() => setFilterLocation(null)}
                                        className={!filterLocation ? 'tab-active' : 'tab-inactive'}
                                        style={{ padding: '0.4rem 1rem', borderRadius: '100px', fontSize: '0.75rem', border: '1px solid var(--glass-border)' }}
                                    >
                                        All Places
                                    </button>
                                    {availableLocations.map(loc => (
                                        <button
                                            key={loc}
                                            onClick={() => setFilterLocation(loc)}
                                            className={filterLocation === loc ? 'tab-active' : 'tab-inactive'}
                                            style={{ padding: '0.4rem 1rem', borderRadius: '100px', fontSize: '0.75rem', border: '1px solid var(--glass-border)' }}
                                        >
                                            {loc}
                                        </button>
                                    ))}
                                </div>

                                {(filterPersonId || filterLocation) && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        marginBottom: '1.5rem',
                                        padding: '0.75rem 1.25rem',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        animation: 'fadeIn 0.3s'
                                    }}>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                            Active Filters: {filterPersonId && <strong>@{people.find(p => p.personId === filterPersonId)?.name || 'Person'} </strong>}
                                            {filterLocation && <strong>📍{filterLocation}</strong>}
                                        </span>
                                        <button
                                            onClick={() => { setFilterPersonId(null); setFilterLocation(null); }}
                                            style={{
                                                marginLeft: 'auto',
                                                color: 'var(--accent-primary)',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✕ Reset All
                                        </button>
                                    </div>
                                )}
                                {filteredImages.length === 0 ? (
                                    <div className="glass" style={{ padding: '5rem', textAlign: 'center' }}>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem' }}>
                                            No images found {filterPersonId ? 'for this person' : ''}.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                        gap: '2rem'
                                    }}>
                                        {filteredImages.map((image) => (
                                            <ImageCard key={image.imageId} image={image} people={people} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {currentTab === 'people' && (
                            people.length === 0 ? (
                                <div className="glass" style={{ padding: '5rem', textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem' }}>
                                        No identities extracted yet. Processing images will automatically identify and catalog people.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <MergePeopleSection people={people} onSuccess={fetchData} />
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '1.5rem'
                                    }}>
                                        {people.map((person) => (
                                            <PersonCard
                                                key={person.personId}
                                                person={person}
                                                relationships={relationships}
                                                people={people}
                                                onRename={fetchData}
                                                onClick={() => handlePersonClick(person.personId)}
                                            />
                                        ))}
                                    </div>
                                </>
                            )
                        )}

                        {currentTab === 'relationships' && (
                            <>
                                <NetworkGraph people={people} relationships={relationships} />
                                <RelationshipSection relationships={relationships} people={people} />
                            </>
                        )}

                        {currentTab === 'timeline' && (
                            <EventTimeline events={events} />
                        )}

                        {currentTab === 'journal' && (
                            <JournalSection journals={journals} onRefresh={fetchData} />
                        )}

                        {currentTab === 'map' && (
                            <MapView images={images} />
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
