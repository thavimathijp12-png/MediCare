package com.medicare.service;

import com.medicare.entity.ActivityRecord;
import com.medicare.repository.ActivityRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ActivityService {

    private final ActivityRepository activityRepository;

    public ActivityService(ActivityRepository activityRepository) {
        this.activityRepository = activityRepository;
    }

    public List<ActivityRecord> getAll() {
        return activityRepository.findAll();
    }

    public List<ActivityRecord> getRecent(int limit) {
        return activityRepository.findTop(limit);
    }
}

