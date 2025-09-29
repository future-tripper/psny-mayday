"""
Visualization Development Database Configuration
Separate database connection for visualization testing
"""

from sqlmodel import create_engine, Session
import os

# Environment variable to switch between test and production data for visualization
USE_TEST_DATA = os.getenv("MAYDAY_VIZ_TEST", "false").lower() == "true"

if USE_TEST_DATA:
    VIZ_DATABASE_URL = "sqlite:///./visualization_dev/test_database.db"
    print("🧪 Visualization using TEST database")
else:
    VIZ_DATABASE_URL = "sqlite:///./mayday.db"
    print("🏭 Visualization using PRODUCTION database")

viz_engine = create_engine(VIZ_DATABASE_URL, echo=False)


def get_viz_session():
    """Get database session for visualization endpoints"""
    with Session(viz_engine) as session:
        yield session